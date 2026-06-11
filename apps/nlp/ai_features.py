"""
DeployGuard AI Features — regression explanations & project health reviews.

Both features use the shared groq_client.call_groq() and degrade gracefully
when the Groq API is unavailable (returns a safe fallback string).
"""

from groq_client import call_groq

# ── System prompts ─────────────────────────────────────────────────────────────

_EXPLAIN_SYSTEM_PROMPT = (
    "You are DeployGuard AI, a performance regression analyst for GitHub pull "
    "requests. Speak directly to the developer (\"your bundle\", \"your commit\"). "
    "Cover exactly three things in order: "
    "1. WHAT happened (the regression) "
    "2. WHY it likely happened (based on the data) "
    "3. HOW to fix it. "
    "Max 5 bullet points total. Use GitHub Markdown formatting. "
    "Never mention or invent package names not present in the data. "
    "If the cause is \"unknown\", say the cause is unclear and give general "
    "bundle analysis advice. "
    "End with exactly one concrete, copy-pasteable fix command or code suggestion."
)

_REVIEW_SYSTEM_PROMPT = (
    "You are DeployGuard AI, a project health analyst. "
    "Structure your response STRICTLY as three sections with these exact headers: "
    "\u2705 Strengths | \u26a0\ufe0f Risks | \U0001f527 Recommendations. "
    "Exactly 3 bullet points per section, no more no less. "
    "Every bullet point must reference at least one actual number from the "
    "input data — no generic advice. "
    "If pass rate is below 70%, flag it as critical in Risks. "
    "If the same package appears multiple times, call it out by name in Risks. "
    "If worst regression > 100 KB, treat it as a serious concern. "
    "Speak to the project owner directly (\"your project\", \"your team\"). "
    "Use GitHub Markdown formatting."
)


_SUMMARY_SYSTEM_PROMPT = (
    "You are DeployGuard AI, a performance regression analyst for GitHub pull "
    "requests. The latest check PASSED — all metrics are within thresholds. "
    "Write a brief, positive summary (2-3 bullet points) confirming what's "
    "healthy. Mention the actual numbers from the data. "
    "Keep it concise and encouraging. Use GitHub Markdown formatting."
)


# ── Feature 1: AI Regression Explanation ───────────────────────────────────────

async def explain_regression(
    bundle_delta_kb: float,
    bundle_delta_pct: float,
    added_packages: list[str],
    removed_packages: list[str],
    commit_messages: list[str],
    nlp_cause: str,
) -> str:
    """Explain a performance regression using Groq."""

    user_prompt = (
        f"Performance regression data:\n"
        f"- Bundle delta: {bundle_delta_kb} KB ({bundle_delta_pct}%)\n"
        f"- Added packages: {_fmt_list(added_packages)}\n"
        f"- Removed packages: {_fmt_list(removed_packages)}\n"
        f"- Commit messages: {_fmt_commits(commit_messages)}\n"
        f"- NLP cause label: {nlp_cause}\n\n"
        "Explain this regression in plain English for the developer "
        "who made these changes."
    )

    result = await call_groq(
        _EXPLAIN_SYSTEM_PROMPT, user_prompt,
        temperature=0.3, max_tokens=600,
    )
    return result if result is not None else "_AI explanation was not available at this time._"


# ── Feature 1b: AI Pass Summary ────────────────────────────────────────────────

async def summarize_pass(
    bundle_delta_kb: float,
    bundle_delta_pct: float,
    added_packages: list[str],
    removed_packages: list[str],
    commit_messages: list[str],
) -> str:
    """Short positive summary when all checks pass."""

    user_prompt = (
        f"Check passed — all metrics within thresholds:\n"
        f"- Bundle delta: {bundle_delta_kb} KB ({bundle_delta_pct}%)\n"
        f"- Added packages: {_fmt_list(added_packages)}\n"
        f"- Removed packages: {_fmt_list(removed_packages)}\n"
        f"- Commit messages: {_fmt_commits(commit_messages)}\n\n"
        "Write a brief positive summary confirming all good."
    )

    result = await call_groq(
        _SUMMARY_SYSTEM_PROMPT, user_prompt,
        temperature=0.3, max_tokens=300,
    )
    return result if result is not None else "_AI summary was not available at this time._"


# ── Feature 2: AI Project Health Review ────────────────────────────────────────

async def review_repo(
    repo_name: str,
    total_checks: int,
    passed_checks: int,
    failed_checks: int,
    avg_bundle_kb: float,
    worst_regression_kb: float,
    most_common_cause: str,
    recent_packages_added: list[str],
) -> str:
    """Generate a structured health review using Groq."""

    pass_rate = round((passed_checks / total_checks) * 100) if total_checks > 0 else 0

    user_prompt = (
        f"Project health data for {repo_name}:\n"
        f"- Total checks: {total_checks}\n"
        f"- Passed checks: {passed_checks}\n"
        f"- Failed checks: {failed_checks}\n"
        f"- Pass rate: {pass_rate}%\n"
        f"- Average bundle size: {avg_bundle_kb} KB\n"
        f"- Worst regression: {worst_regression_kb} KB\n"
        f"- Most common cause: {most_common_cause}\n"
        f"- Recently added packages: {_fmt_list(recent_packages_added[:20])}\n\n"
        "Provide a structured health review for this project."
    )

    result = await call_groq(
        _REVIEW_SYSTEM_PROMPT, user_prompt,
        temperature=0.4, max_tokens=700,
    )
    return result if result is not None else "_AI health review was not available at this time._"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_list(items: list[str]) -> str:
    return ", ".join(items) if items else "none"


def _fmt_commits(messages: list[str], limit: int = 10) -> str:
    return " | ".join(messages[:limit]) if messages else "none"
