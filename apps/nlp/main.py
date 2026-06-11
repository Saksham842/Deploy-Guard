"""
DeployGuard NLP Microservice — v2
FastAPI server that classifies commit messages to explain performance regressions.

Model priority:
  1. model_v2.pkl  (sentence-transformers, 10 classes)  ← preferred
  2. commit_classifier.joblib + commit_vectorizer.joblib (TF-IDF v1 fallback)
  3. Groq LLM (llama-3.1-8b-instant) ← for low-confidence / vague commits

Start:  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
Train:  python train_v2.py  (builds model_v2.pkl)
"""

import os
import pickle
import logging
import json
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ai_features import explain_regression, review_repo, summarize_pass

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger("deployguard-nlp")

# ── Valid classification classes ───────────────────────────────────────────────
ALL_CLASSES = [
    "bundle_size", "query_regression", "latency_spike", "dependency_bloat",
    "new_dependency", "asset_added", "feature", "refactor", "chore", "unknown"
]

# ── Model state ────────────────────────────────────────────────────────────────
MODEL_STATE: Dict[str, Any] = {
    "clf":           None,
    "vec":           None,          # TF-IDF vectorizer (v1 only)
    "encoder":       None,          # SentenceTransformer (v2 only)
    "label_encoder": None,
    "version":       "none",
    "classes":       [],
    "n_samples":     0,
    "cv_f1":         0.0,
    "use_st":        False,         # True = v2 sentence-transformers
}

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL     = "llama-3.1-8b-instant"
GROQ_ENABLED   = bool(GROQ_API_KEY)

# ── Model loader ───────────────────────────────────────────────────────────────
def load_models():
    MODEL_DIR = os.getenv("MODEL_DIR", os.path.dirname(__file__) or ".")

    # ── Try v2 first (model_v2.pkl) ────────────────────────────────────────────
    v2_path = os.path.join(MODEL_DIR, "model_v2.pkl")
    if os.path.exists(v2_path):
        try:
            with open(v2_path, "rb") as f:
                data = pickle.load(f)
            MODEL_STATE["clf"]           = data["classifier"]
            MODEL_STATE["label_encoder"] = data["label_encoder"]
            MODEL_STATE["classes"]       = data["classes"]
            MODEL_STATE["n_samples"]     = data.get("n_samples", 0)
            MODEL_STATE["cv_f1"]         = data.get("cv_f1", 0.0)
            MODEL_STATE["use_st"]        = data.get("use_sentence_transformers", False)
            MODEL_STATE["version"]       = "v2-sentence-transformers" if MODEL_STATE["use_st"] else "v2-tfidf"

            if MODEL_STATE["use_st"] and data.get("encoder"):
                MODEL_STATE["encoder"] = data["encoder"]
            elif not MODEL_STATE["use_st"] and data.get("tfidf"):
                MODEL_STATE["vec"] = data["tfidf"]

            logger.info("✅ Loaded model_v2.pkl  version=%s  classes=%s  cv_f1=%.3f",
                        MODEL_STATE["version"], MODEL_STATE["classes"], MODEL_STATE["cv_f1"])
            return
        except Exception as e:
            logger.warning("⚠️  Could not load model_v2.pkl: %s — trying v1 fallback", e)

    # ── Fallback: v1 .joblib ───────────────────────────────────────────────────
    clf_path = os.path.join(MODEL_DIR, "commit_classifier.joblib")
    vec_path = os.path.join(MODEL_DIR, "commit_vectorizer.joblib")
    if os.path.exists(clf_path) and os.path.exists(vec_path):
        try:
            import joblib
            MODEL_STATE["clf"]     = joblib.load(clf_path)
            MODEL_STATE["vec"]     = joblib.load(vec_path)
            MODEL_STATE["classes"] = list(MODEL_STATE["clf"].classes_)
            MODEL_STATE["version"] = "v1-tfidf"
            MODEL_STATE["use_st"]  = False
            logger.info("✅ Loaded v1 TF-IDF model  classes=%s", MODEL_STATE["classes"])
            return
        except Exception as e:
            logger.warning("⚠️  Could not load v1 joblib: %s", e)

    logger.warning("⚠️  No model files found. Only Groq fallback will be used.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    if GROQ_ENABLED:
        logger.info("🤖 Groq fallback ENABLED  model=%s", GROQ_MODEL)
    else:
        logger.info("ℹ️  Groq fallback DISABLED  (set GROQ_API_KEY to enable)")
    yield

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DeployGuard NLP Service",
    description="Classifies commit messages to explain performance regressions. v2 with Groq fallback.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Schemas ────────────────────────────────────────────────────────────────────
class CommitRequest(BaseModel):
    messages: List[str]
    new_packages: List[str] = []
    removed_packages: List[str] = []

class SingleCommitRequest(BaseModel):
    message: str
    new_packages: List[str] = []
    removed_packages: List[str] = []

class Cause(BaseModel):
    model_config = {"protected_namespaces": ()}

    cause_type: str
    detail: str
    confidence: float
    all_scores: Optional[Dict[str, float]] = None
    model_version: Optional[str] = None
    via_groq: bool = False

class ExplainRequest(BaseModel):
    bundle_delta_kb: float
    bundle_delta_pct: float
    added_packages: List[str] = []
    removed_packages: List[str] = []
    commit_messages: List[str] = []
    nlp_cause: str = "unknown"

class ReviewRequest(BaseModel):
    repo_name: str
    total_checks: int
    passed_checks: int
    failed_checks: int
    avg_bundle_kb: float = 0.0
    worst_regression_kb: float = 0.0
    most_common_cause: str = "unknown"
    recent_packages_added: List[str] = []

# ── ML inference helper ────────────────────────────────────────────────────────
def ml_classify(text: str) -> Optional[Dict]:
    """
    Run the local ML model on a single text.
    Returns dict with cause, confidence, all_scores — or None if model not loaded.
    """
    clf = MODEL_STATE["clf"]
    if clf is None:
        return None

    try:
        # Vectorize
        if MODEL_STATE["use_st"] and MODEL_STATE["encoder"]:
            X = MODEL_STATE["encoder"].encode([text])
        elif MODEL_STATE["vec"]:
            X = MODEL_STATE["vec"].transform([text])
        else:
            return None

        pred_idx  = clf.predict(X)[0]
        proba     = clf.predict_proba(X)[0]
        le        = MODEL_STATE["label_encoder"]

        if le is not None:
            pred_label = le.inverse_transform([pred_idx])[0]
            classes    = le.classes_.tolist()
        else:
            pred_label = MODEL_STATE["classes"][pred_idx] if isinstance(pred_idx, int) else str(pred_idx)
            classes    = MODEL_STATE["classes"]

        all_scores = {cls: round(float(p), 4) for cls, p in zip(classes, proba)}
        confidence = float(max(proba))

        return {
            "cause":      pred_label,
            "confidence": confidence,
            "all_scores": all_scores,
        }
    except Exception as e:
        logger.error("ML inference error: %s", e)
        return None


# ── Groq fallback ──────────────────────────────────────────────────────────────
async def groq_classify(message: str) -> Optional[Dict]:
    """
    Ask Groq llama-3.1-8b-instant to classify a vague commit message.
    Returns dict with cause, confidence, all_scores — or None on failure.
    """
    if not GROQ_ENABLED:
        return None

    system_prompt = f"""You are an expert software engineer classifying git commit messages for a performance monitoring tool called DeployGuard.

Classify the commit message into EXACTLY ONE of these categories:
- bundle_size       : Adds heavy frontend libs, UI components, or packages that increase JS bundle
- query_regression  : N+1 queries, missing DB index, unbounded fetches, removed pagination
- latency_spike     : Blocking I/O, heavy sync operations in request path, no timeouts
- dependency_bloat  : Lockfile changes, transitive deps, npm audit fix, version bumps
- new_dependency    : A new npm/pip package is being added for the first time
- asset_added       : Images, fonts, videos, PDFs, icons added to static assets
- feature           : New product functionality built from scratch
- refactor          : Code restructuring with no functional change
- chore             : Docs, config, formatting, version bumps, cleanup
- unknown           : Vague or uninformative message (wip, fix, temp, single word)

Respond ONLY with valid JSON — no explanation, no markdown:
{{"cause": "<category>", "confidence": <0.0-1.0>, "reason": "<one sentence>"}}"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       GROQ_MODEL,
                    "messages": [
                        {"role": "system",  "content": system_prompt},
                        {"role": "user",    "content": f'Classify this commit: "{message}"'},
                    ],
                    "temperature": 0.1,
                    "max_tokens":  120,
                },
            )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content)

        cause      = result.get("cause", "unknown")
        confidence = float(result.get("confidence", 0.5))
        reason     = result.get("reason", "")

        # Validate class
        if cause not in ALL_CLASSES:
            cause = "unknown"

        return {
            "cause":      cause,
            "confidence": round(confidence, 3),
            "all_scores": {c: round(confidence if c == cause else (1 - confidence) / (len(ALL_CLASSES) - 1), 4) for c in ALL_CLASSES},
            "reason":     reason,
        }
    except Exception as e:
        logger.warning("Groq classify failed for '%s': %s", message[:60], e)
        return None


# ── Core classification pipeline ───────────────────────────────────────────────
async def classify_message(text: str) -> Cause:
    """
    Full pipeline for a single commit message:
    1. Local ML model
    2. If confidence < 0.55 → try Groq
    3. If Groq unavailable → return best ML guess with low_confidence flag
    """
    CONFIDENCE_THRESHOLD = 0.55
    via_groq = False

    ml_result = ml_classify(text)

    if ml_result and ml_result["confidence"] >= CONFIDENCE_THRESHOLD:
        # ML is confident — use it
        return Cause(
            cause_type    = ml_result["cause"],
            detail        = f'Commit: "{text[:120]}"',
            confidence    = round(ml_result["confidence"], 3),
            all_scores    = ml_result["all_scores"],
            model_version = MODEL_STATE["version"],
            via_groq      = False,
        )

    # ML not confident enough (or no model) → try Groq
    groq_result = await groq_classify(text)
    if groq_result:
        via_groq = True
        return Cause(
            cause_type    = groq_result["cause"],
            detail        = groq_result.get("reason", f'Commit: "{text[:120]}"'),
            confidence    = groq_result["confidence"],
            all_scores    = groq_result["all_scores"],
            model_version = f"groq/{GROQ_MODEL}",
            via_groq      = True,
        )

    # Neither ML nor Groq worked — return best ML guess anyway, or unknown
    if ml_result:
        return Cause(
            cause_type    = ml_result["cause"],
            detail        = f'Low-confidence ML guess for: "{text[:120]}"',
            confidence    = round(ml_result["confidence"], 3),
            all_scores    = ml_result["all_scores"],
            model_version = MODEL_STATE["version"],
            via_groq      = False,
        )

    return Cause(
        cause_type    = "unknown",
        detail        = f'Could not classify: "{text[:120]}"',
        confidence    = 0.0,
        all_scores    = {c: 0.0 for c in ALL_CLASSES},
        model_version = "none",
        via_groq      = False,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":          "ok",
        "service":         "deployguard-nlp",
        "model_version":   MODEL_STATE["version"],
        "model_loaded":    MODEL_STATE["clf"] is not None,
        "classes":         MODEL_STATE["classes"],
        "n_training_samples": MODEL_STATE["n_samples"],
        "cv_f1_macro":     MODEL_STATE["cv_f1"],
        "groq_enabled":    GROQ_ENABLED,
        "groq_model":      GROQ_MODEL if GROQ_ENABLED else None,
    }


@app.post("/classify")
async def classify(req: CommitRequest):
    """
    Backward-compatible endpoint.
    Accepts a list of commit messages + package diffs.
    Returns a ranked list of Cause objects (max 5).
    """
    causes: List[Cause] = []

    # ── Rule 1: Deterministic — new packages almost always cause bundle growth ─
    if req.new_packages:
        pkg_list = ", ".join(req.new_packages[:10])
        causes.append(Cause(
            cause_type    = "new_dependency",
            detail        = f"Added packages: {pkg_list}",
            confidence    = 0.95,
            all_scores    = {"new_dependency": 0.95},
            model_version = "rule-based",
            via_groq      = False,
        ))

    # ── Rule 2: Removed packages — refactor signal ────────────────────────────
    if req.removed_packages and not req.new_packages:
        pkg_list = ", ".join(req.removed_packages[:5])
        causes.append(Cause(
            cause_type    = "refactor",
            detail        = f"Removed packages: {pkg_list} — verify tree-shaking is working",
            confidence    = 0.75,
            all_scores    = {"refactor": 0.75},
            model_version = "rule-based",
            via_groq      = False,
        ))

    # ── Rule 3: ML + Groq classification of each commit message ───────────────
    if req.messages:
        filtered = [m.strip() for m in req.messages if len(m.strip()) > 2]
        seen_types: set = set()

        for msg in filtered:
            cause = await classify_message(msg)

            # Skip repeated cause types (keep highest confidence)
            if cause.cause_type in seen_types:
                continue
            # Don't surface chore/unknown if stronger signals already exist
            if cause.cause_type in ("chore", "unknown") and len(causes) > 0:
                continue

            causes.append(cause)
            seen_types.add(cause.cause_type)

    # Sort by confidence descending and cap at 5
    causes.sort(key=lambda c: c.confidence, reverse=True)
    return causes[:5]


@app.post("/classify/single")
async def classify_single(req: SingleCommitRequest):
    """
    Classify a single commit message and return full score breakdown.
    """
    cause = await classify_message(req.message)
    return cause


@app.post("/classify/batch")
async def classify_batch(req: CommitRequest):
    """
    Classify each commit message independently and return all results.
    No deduplication — every message gets its own classification.
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages list is empty")

    results = []
    for msg in req.messages:
        msg = msg.strip()
        if not msg:
            continue
        cause = await classify_message(msg)
        results.append({
            "message":      msg,
            "cause":        cause.cause_type,
            "confidence":   cause.confidence,
            "all_scores":   cause.all_scores,
            "model_version": cause.model_version,
            "via_groq":     cause.via_groq,
            "detail":       cause.detail,
        })
    return results


@app.post("/explain")
async def explain(req: ExplainRequest):
    explanation = await explain_regression(
        bundle_delta_kb=req.bundle_delta_kb,
        bundle_delta_pct=req.bundle_delta_pct,
        added_packages=req.added_packages,
        removed_packages=req.removed_packages,
        commit_messages=req.commit_messages,
        nlp_cause=req.nlp_cause,
    )
    return {"explanation": explanation}


@app.post("/summarize")
async def summarize(req: ExplainRequest):
    summary = await summarize_pass(
        bundle_delta_kb=req.bundle_delta_kb,
        bundle_delta_pct=req.bundle_delta_pct,
        added_packages=req.added_packages,
        removed_packages=req.removed_packages,
        commit_messages=req.commit_messages,
    )
    return {"summary": summary}


@app.post("/review")
async def review(req: ReviewRequest):
    report = await review_repo(
        repo_name=req.repo_name,
        total_checks=req.total_checks,
        passed_checks=req.passed_checks,
        failed_checks=req.failed_checks,
        avg_bundle_kb=req.avg_bundle_kb,
        worst_regression_kb=req.worst_regression_kb,
        most_common_cause=req.most_common_cause,
        recent_packages_added=req.recent_packages_added,
    )
    return {"report": report}
