import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "concursos" / "normalize_options.py"
spec = importlib.util.spec_from_file_location("normalize_options", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
normalize_option = module.normalize_option


def test_capitalizes_the_first_letter_and_adds_the_final_period() -> None:
    assert normalize_option("registrar consentimento, escopo, finalidade e revogação") == (
        "Registrar consentimento, escopo, finalidade e revogação."
    )
    assert normalize_option("a dona maria") == "A dona maria."


def test_keeps_what_is_already_standard_and_is_idempotent() -> None:
    for text in ("Dispensar autenticação.", "Isto está certo?", "Cuidado!"):
        assert normalize_option(text) == text
    once = normalize_option("impedir auditoria")
    assert normalize_option(once) == once


def test_replaces_a_trailing_colon_semicolon_or_comma_with_a_period() -> None:
    assert normalize_option("garantir a integridade;") == "Garantir a integridade."
    assert normalize_option("Itens abaixo:") == "Itens abaixo."


def test_numeric_alternatives_get_a_period_but_nothing_else_changes() -> None:
    assert normalize_option("200") == "200."
    assert normalize_option("R$ 180") == "R$ 180."
    assert normalize_option("0,1") == "0,1."
    assert normalize_option("200 ms") == "200 ms."


def test_trims_surrounding_spaces() -> None:
    assert normalize_option("  usar dados  ") == "Usar dados."
