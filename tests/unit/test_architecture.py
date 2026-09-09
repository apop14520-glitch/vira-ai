from pathlib import Path


ROOT = Path(__file__).parents[2]


def test_product_modules_are_not_coupled_to_external_integrations() -> None:
    modules = ROOT / "modules"
    integrations = ROOT / "integrations"

    assert {path.name for path in modules.iterdir()} >= {
        "business",
        "sites",
        "studio",
        "concursos",
    }
    assert not list(modules.rglob("*.py"))
    assert "Não implementado" in (integrations / "scraping" / "README.md").read_text(
        encoding="utf-8"
    )
