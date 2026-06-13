"""
DeployGuard — shared Groq API client.

Reusable async wrapper around Groq's /chat/completions endpoint.
Used by:
  - ai_features.py  (explain_regression, review_repo)
  - main.py         (/classify fallback — groq_classify)

Usage:
    text = await call_groq("system prompt", "user prompt")

Environment:
    GROQ_API_KEY     — required, get one at https://console.groq.com
    GROQ_MODEL       — optional, defaults to llama-3.3-70b-versatile
"""

from dotenv import load_dotenv
import os
import logging
import httpx
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

logger = logging.getLogger("deployguard-nlp")


async def call_groq(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 600,
    model: str | None = None,
) -> str | None:
    """
    Call Groq /chat/completions and return the response text.

    Parameters
    ----------
    system_prompt : str
        System-level instruction for the LLM.
    user_prompt : str
        The user message / query.
    temperature : float, optional
        Sampling temperature (default 0.3).
    max_tokens : int, optional
        Maximum tokens in the response (default 600).
    model : str, optional
        Override GROQ_MODEL for this call.

    Returns
    -------
    str | None
        The model's response text, or None on ANY failure.
        Never raises — always fails gracefully.
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set — skipping Groq call")
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       model or GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens":  max_tokens,
                },
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    except Exception as exc:
        logger.warning("Groq API call failed: %s", exc)
        return None
