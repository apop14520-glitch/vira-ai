"""Vendor-neutral AI Gateway contracts."""

from .contracts import AIProvider, AIRequest, AIResponse, ModelRouter, SafetyAction, SafetyVerdict
from .guardrails import inspect_prompt, normalize_prompt
from .evaluation import (
    CategoryMetrics,
    EvaluationCase,
    EvaluationOutcome,
    EvaluationReport,
    run_prompt_evaluation,
)

__all__ = [
    "AIProvider",
    "AIRequest",
    "AIResponse",
    "CategoryMetrics",
    "EvaluationCase",
    "EvaluationOutcome",
    "EvaluationReport",
    "ModelRouter",
    "inspect_prompt",
    "normalize_prompt",
    "SafetyAction",
    "SafetyVerdict",
    "run_prompt_evaluation",
]
