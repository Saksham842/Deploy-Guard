"""
DeployGuard NLP Microservice
FastAPI app that classifies commit messages to explain performance regressions.

Start:  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
Train:  python train.py  (must be run first to create .joblib files)
"""

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import joblib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deployguard-nlp")

# ─── Load models at startup ────────────────────────────────────────────────────
MODEL_PATH = os.getenv("MODEL_DIR", ".")
try:
    clf = joblib.load(os.path.join(MODEL_PATH, "commit_classifier.joblib"))
    vec = joblib.load(os.path.join(MODEL_PATH, "commit_vectorizer.joblib"))
    logger.info("✅ Models loaded. Classes: %s", list(clf.classes_))
except FileNotFoundError:
    logger.warning("⚠️  .joblib files not found — run `python train.py` first")
    clf = None
    vec = None

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="DeployGuard NLP Service",
    description="Classifies commit messages to explain performance regressions",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Schemas ──────────────────────────────────────────────────────────────────

class CommitRequest(BaseModel):
    messages: List[str]
    new_packages: List[str] = []
    removed_packages: List[str] = []

class Cause(BaseModel):
    cause_type: str   # new_dependency|asset_added|feature|refactor|chore|unknown
    detail: str
    confidence: float

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "deployguard-nlp",
        "model_loaded": clf is not None,
    }

@app.post("/classify", response_model=List[Cause])
async def classify(req: CommitRequest):
    causes: List[Cause] = []

    # ── Rule 1: Deterministic — new packages almost always cause bundle growth ─
    if req.new_packages:
        pkg_list = ", ".join(req.new_packages[:10])
        causes.append(Cause(
            cause_type="new_dependency",
            detail=f"Added packages: {pkg_list}",
            confidence=0.95,
        ))

    # ── Rule 2: Removed packages — unlikely to cause regression, note anyway ──
    if req.removed_packages and not req.new_packages:
        pkg_list = ", ".join(req.removed_packages[:5])
        causes.append(Cause(
            cause_type="refactor",
            detail=f"Removed packages: {pkg_list} — verify tree-shaking is working",
            confidence=0.75,
        ))

    # ── Rule 3: ML classification of commit messages ──────────────────────────
    if req.messages and clf is not None and vec is not None:
        # Filter out very short / noisy messages
        filtered = [m.strip() for m in req.messages if len(m.strip()) > 4]

        if filtered:
            X = vec.transform(filtered)
            predictions = clf.predict(X)
            probas = clf.predict_proba(X)

            seen_types: set = set()
            for msg, pred, proba in zip(filtered, predictions, probas):
                confidence = float(max(proba))

                # Skip low-confidence and chore/unknown unless no other causes
                if confidence < 0.60:
                    continue
                if pred in ("chore", "unknown") and len(causes) > 0:
                    continue
                # Deduplicate cause types (keep highest confidence)
                if pred in seen_types:
                    continue

                causes.append(Cause(
                    cause_type=pred,
                    detail=f'Commit: "{msg[:100]}"',
                    confidence=round(confidence, 2),
                ))
                seen_types.add(pred)

    elif req.messages and clf is None:
        logger.warning("Model not loaded — skipping ML classification")
        causes.append(Cause(
            cause_type="unknown",
            detail="NLP model not loaded — run `python train.py` to enable classification",
            confidence=0.0,
        ))

    # Sort by confidence descending and cap at 5
    causes.sort(key=lambda c: c.confidence, reverse=True)
    return causes[:5]
