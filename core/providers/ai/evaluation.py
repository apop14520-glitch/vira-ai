"""Offline evaluation primitives for AI Gateway safety decisions."""

from dataclasses import dataclass
from typing import Callable, Sequence

from .contracts import SafetyAction, SafetyVerdict
from .guardrails import inspect_prompt


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    prompt: str
    expected_action: SafetyAction
    expected_category: str


@dataclass(frozen=True)
class EvaluationOutcome:
    case_id: str
    expected_action: SafetyAction
    actual_action: SafetyAction
    expected_category: str
    actual_category: str
    matched: bool


@dataclass(frozen=True)
class CategoryMetrics:
    category: str
    total: int
    matched: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float


@dataclass(frozen=True)
class EvaluationReport:
    total: int
    matched: int
    false_positives: int
    false_negatives: int
    accuracy: float
    precision: float
    recall: float
    outcomes: tuple[EvaluationOutcome, ...]
    category_metrics: tuple[CategoryMetrics, ...] = ()


def _ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def _is_positive(action: SafetyAction) -> bool:
    return action is not SafetyAction.ALLOW


def run_prompt_evaluation(
    cases: Sequence[EvaluationCase],
    inspector: Callable[[str], SafetyVerdict] = inspect_prompt,
) -> EvaluationReport:
    """Evaluate cases in order without logging or sending their prompt text."""

    outcomes = tuple(
        EvaluationOutcome(
            case_id=case.case_id,
            expected_action=case.expected_action,
            actual_action=(verdict := inspector(case.prompt)).action,
            expected_category=case.expected_category,
            actual_category=verdict.category,
            matched=(
                verdict.action is case.expected_action
                and verdict.category == case.expected_category
            ),
        )
        for case in cases
    )

    true_positives = sum(
        _is_positive(outcome.expected_action)
        and _is_positive(outcome.actual_action)
        and outcome.matched
        for outcome in outcomes
    )
    false_positives = sum(
        not _is_positive(outcome.expected_action)
        and _is_positive(outcome.actual_action)
        for outcome in outcomes
    )
    false_negatives = sum(
        _is_positive(outcome.expected_action)
        and not _is_positive(outcome.actual_action)
        for outcome in outcomes
    )
    matched = sum(outcome.matched for outcome in outcomes)

    categories = sorted(
        {
            outcome.expected_category
            for outcome in outcomes
            if outcome.expected_category != "none"
        }
    )
    category_metrics = tuple(
        _category_metrics(category, outcomes)
        for category in categories
    )

    return EvaluationReport(
        total=len(outcomes),
        matched=matched,
        false_positives=false_positives,
        false_negatives=false_negatives,
        accuracy=_ratio(matched, len(outcomes)),
        precision=_ratio(true_positives, true_positives + false_positives),
        recall=_ratio(true_positives, true_positives + false_negatives),
        outcomes=outcomes,
        category_metrics=category_metrics,
    )


def _category_metrics(
    category: str,
    outcomes: Sequence[EvaluationOutcome],
) -> CategoryMetrics:
    category_outcomes = tuple(
        outcome for outcome in outcomes if outcome.expected_category == category
    )
    true_positives = sum(
        outcome.expected_category == category
        and outcome.actual_category == category
        and _is_positive(outcome.expected_action)
        and _is_positive(outcome.actual_action)
        for outcome in outcomes
    )
    false_positives = sum(
        outcome.expected_category != category
        and outcome.actual_category == category
        and _is_positive(outcome.actual_action)
        for outcome in outcomes
    )
    false_negatives = sum(
        outcome.expected_category == category
        and (
            outcome.actual_category != category
            or not _is_positive(outcome.actual_action)
        )
        for outcome in outcomes
    )
    return CategoryMetrics(
        category=category,
        total=len(category_outcomes),
        matched=sum(outcome.matched for outcome in category_outcomes),
        false_positives=false_positives,
        false_negatives=false_negatives,
        precision=_ratio(true_positives, true_positives + false_positives),
        recall=_ratio(true_positives, true_positives + false_negatives),
    )
