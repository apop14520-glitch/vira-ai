"""Extrai a teoria do "Manual Completo para Concursos de TI" (PDF) para JSON, um arquivo por Parte.

Uso (o PDF do manual não faz parte do repositório; o script apenas o lê):

    pip install pymupdf
    python extract_manual.py caminho/do/manual.pdf --out saida/

A estrutura vem da tipografia do livro: título da Parte, capítulo "N.M", seções (negrito),
corpo, caixas "IMPORTANTE LEMBRAR!", tabelas e "Revisão do capítulo" em tópicos.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import pymupdf

HEADER_LIMIT = 37.0  # acima disto fica o cabeçalho corrente do livro
FOOTER_LIMIT = 649.0  # abaixo disto fica o rodapé ("Edição 3.0+ | N")
FIRST_THEORY_LABEL = "Parte 1 "
LAST_THEORY_PART = 29  # a Parte 30 em diante são cadernos de questões, simulado e gabarito
MIN_COVERAGE = 0.995

PART_TITLE = re.compile(r"^Parte (\d+)\s+(.+)$")
CHAPTER_TITLE = re.compile(r"^(\d+\.\d+)\s+(.+)$")
DEFINITION = re.compile(r"^(?P<term>[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^:.;!?]{0,58}?):\s+(?P<text>[a-záàâãéêíóôõúç0-9(].*)$")
CALLOUT_LABEL = "IMPORTANTE LEMBRAR!"
TERMINAL_PUNCTUATION = (".", "!", "?", ":", ";", ")", '"', "”")
FULL_LINE_WIDTH = 340.0  # linha quebrada pelo fim da caixa de texto (367,8 pt) tem largura próxima disso
ARTICLES = {"A", "O", "As", "Os", "Um", "Uma", "Uns", "Umas"}
LEAD_INS = {"Exemplo", "Atenção", "Observação", "Nota", "Importante"}
FINITE_VERBS = {
    "é", "são", "não", "segue", "seguem", "descreve", "entrega", "usam", "precisa", "precisam",
    "podem", "pode", "afeta", "exigem", "exige", "elimina", "depende", "dependem", "permite",
}


@dataclass
class Row:
    """Uma linha visual do PDF já reunida por baseline (o PDF às vezes a parte em fragmentos)."""

    top: float
    baseline: float
    x0: float
    x1: float
    size: float
    bold: bool
    italic: bool
    text: str


def clean(text: str) -> str:
    text = text.replace(" ", " ").replace("&CK;", "&CK")
    return re.sub(r"\s+", " ", text).strip()


def table_cell(value: str | None) -> str:
    return clean((value or "").replace("\n", " "))


def merge_fragments(fragments: list[Row]) -> Row:
    fragments = sorted(fragments, key=lambda fragment: fragment.x0)
    text = ""
    for fragment in fragments:
        if text and not text.endswith(" ") and not fragment.text.startswith(" "):
            text += " "
        text += fragment.text
    first = fragments[0]
    return Row(
        top=min(fragment.top for fragment in fragments),
        baseline=first.baseline,
        x0=first.x0,
        x1=max(fragment.x1 for fragment in fragments),
        size=first.size,
        bold=first.bold,
        italic=first.italic,
        text=clean(text),
    )


def page_rows(page: pymupdf.Page, table_boxes: list[pymupdf.Rect]) -> list[Row]:
    fragments: list[Row] = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            spans = [span for span in line["spans"] if span["text"].strip()]
            if not spans:
                continue
            top, bottom = line["bbox"][1], line["bbox"][3]
            if top < HEADER_LIMIT or top > FOOTER_LIMIT:
                continue
            center_x = (line["bbox"][0] + line["bbox"][2]) / 2
            center_y = (top + bottom) / 2
            if any(box.contains(pymupdf.Point(center_x, center_y)) for box in table_boxes):
                continue
            lead = spans[0]
            fragments.append(
                Row(
                    top=top,
                    baseline=lead["origin"][1],
                    x0=line["bbox"][0],
                    x1=line["bbox"][2],
                    size=lead["size"],
                    bold=bool(lead["flags"] & 16),
                    italic=bool(lead["flags"] & 2),
                    text="".join(span["text"] for span in line["spans"]),
                )
            )
    fragments.sort(key=lambda fragment: (fragment.baseline, fragment.x0))
    rows: list[Row] = []
    cluster: list[Row] = []
    for fragment in fragments:
        if cluster and abs(fragment.baseline - cluster[0].baseline) > 1.5:
            rows.append(merge_fragments(cluster))
            cluster = []
        cluster.append(fragment)
    if cluster:
        rows.append(merge_fragments(cluster))
    return [row for row in rows if row.text]


def kind_of(row: Row) -> str:
    if abs(row.size - 17.0) < 0.3 and row.bold:
        return "part"
    if abs(row.size - 12.8) < 0.3 and row.bold:
        return "chapter"
    if abs(row.size - 10.5) < 0.3 and row.bold:
        return "heading"
    if abs(row.size - 15.9) < 0.3:
        return "glyph"  # o "!" ao lado da caixa "IMPORTANTE LEMBRAR!"
    if abs(row.size - 9.1) < 0.2 and row.italic:
        return "italic"
    if abs(row.size - 9.1) < 0.2 and row.x0 > 90:
        return "callout"
    if abs(row.size - 9.4) < 0.2 and not row.bold:
        return "body"
    return "other"


PITCH_LIMIT = {"body": 14.0, "italic": 13.5, "callout": 13.5, "heading": 16.0, "chapter": 19.0, "part": 24.0}


def elements_of(doc: pymupdf.Document, first_page: int, last_page: int, warnings: list[str]) -> list[dict]:
    """Percorre as páginas de teoria e devolve uma sequência plana de elementos, em ordem de leitura."""

    elements: list[dict] = []
    for page_index in range(first_page, last_page + 1):
        page = doc[page_index]
        found = page.find_tables()
        tables = [(pymupdf.Rect(table.bbox), table) for table in found.tables]
        rows = page_rows(page, [box for box, _ in tables])
        page_items: list[tuple[float, dict]] = []

        previous: Row | None = None
        current: dict | None = None
        for row in rows:
            kind = kind_of(row)
            if kind == "glyph":
                continue
            if kind == "other":
                warnings.append(f"p.{page_index}: estilo não reconhecido (tam {row.size:.1f}): {row.text[:60]}")
                kind = "body"
            joins = (
                current is not None
                and previous is not None
                and current["kind"] == kind
                and row.baseline - previous.baseline <= PITCH_LIMIT[kind]
                and not (kind == "callout" and row.text.startswith(CALLOUT_LABEL))
            )
            if joins and current is not None:
                current["text"] = f"{current['text']} {row.text}"
                current["last_width"] = row.x1 - row.x0
            else:
                current = {"kind": kind, "text": row.text, "last_width": row.x1 - row.x0, "page": page_index}
                page_items.append((row.top, current))
            previous = row

        for box, table in tables:
            cells = [[table_cell(cell) for cell in raw] for raw in table.extract()]
            cells = [row for row in cells if any(row)]
            if cells:
                page_items.append((box.y0, {"kind": "table", "rows": cells, "page": page_index}))

        page_items.sort(key=lambda item: item[0])
        for position, (_, item) in enumerate(page_items):
            item["page_first"] = position == 0
            elements.append(item)
    return elements


def merge_page_breaks(elements: list[dict]) -> list[dict]:
    """Junta o parágrafo que o PDF partiu entre o fim de uma página e o início da seguinte."""

    merged: list[dict] = []
    for element in elements:
        last = merged[-1] if merged else None
        if (
            last is not None
            and element.get("page_first")
            and element["kind"] in {"body", "italic", "callout"}
            and last["kind"] == element["kind"]
            and last["page"] != element["page"]
        ):
            continues = False
            if element["kind"] == "callout":
                continues = not element["text"].startswith(CALLOUT_LABEL)
            elif element["text"][:1].islower():
                continues = True
            elif not last["text"].endswith(TERMINAL_PUNCTUATION) and last.get("last_width", 0) >= FULL_LINE_WIDTH:
                continues = True
            if continues:
                last["text"] = f"{last['text']} {element['text']}"
                last["last_width"] = element.get("last_width", 0)
                continue
        merged.append(element)
    return merged


def is_definition(term: str, text: str) -> bool:
    """'Termo: glossa' de uma frase. Frases inteiras com dois-pontos e verbos não são definições."""

    words = term.split()
    if len(words) > 4 or words[0] in ARTICLES or term in LEAD_INS:
        return False
    if any(word in FINITE_VERBS for word in words):
        return False
    return ". " not in text


def block_of_paragraph(text: str) -> dict:
    match = DEFINITION.match(text)
    if match and is_definition(match.group("term"), match.group("text")):
        return {"type": "definition", "term": match.group("term"), "text": match.group("text")}
    return {"type": "paragraph", "text": text}


def fix_header(header: list[str], rows: list[list[str]]) -> list[str]:
    """O livro às vezes omite o título da coluna de rótulos, deixando o cabeçalho deslocado à esquerda."""

    if header and not header[-1] and all(header[:-1]) and rows and all(len(row) == len(header) for row in rows):
        return ["", *header[:-1]]
    return header


def build_parts(elements: list[dict], warnings: list[str]) -> list[dict]:
    parts: list[dict] = []
    part: dict | None = None
    chapter: dict | None = None
    section: dict | None = None
    mode = "summary"  # summary | body | review | sources
    caption: str | None = None
    pending_review: list[str] = []

    def close_review() -> None:
        nonlocal pending_review
        if chapter is not None and pending_review:
            chapter["review"] = [item for item in re.split(r"\s*•\s*", " ".join(pending_review)) if item.strip()]
        pending_review = []

    def ensure_chapter(title: str = "") -> dict:
        nonlocal chapter, section
        if chapter is None:
            assert part is not None
            chapter = {"number": "", "title": title or part["name"], "objective": "", "sections": [], "review": []}
            part["chapters"].append(chapter)
            section = None
        return chapter

    def ensure_section(heading: str = "") -> dict:
        nonlocal section
        current = ensure_chapter()
        if section is None:
            section = {"heading": heading, "blocks": []}
            current["sections"].append(section)
        return section

    for index, element in enumerate(elements):
        kind = element["kind"]
        upcoming = elements[index + 1]["kind"] if index + 1 < len(elements) else ""

        if kind == "part":
            title = PART_TITLE.match(element["text"])
            if not title:
                warnings.append(f"título de Parte inesperado: {element['text']}")
                continue
            close_review()
            number = int(title.group(1))
            if number > LAST_THEORY_PART:
                break
            part = {
                "number": number,
                "name": title.group(2),
                "summary": "",
                "chapters": [],
                "sources": "",
            }
            parts.append(part)
            chapter = section = None
            mode = "summary"
            continue

        if part is None:
            continue

        if kind == "chapter":
            match = CHAPTER_TITLE.match(element["text"])
            close_review()
            # A Parte 29 (revisão estratégica) usa o mesmo estilo para blocos sem número de capítulo.
            number, title = (match.group(1), match.group(2)) if match else ("", element["text"])
            chapter = {"number": number, "title": title, "objective": "", "sections": [], "review": []}
            part["chapters"].append(chapter)
            section = None
            caption = None
            mode = "body"
            continue

        if kind == "heading":
            heading = element["text"]
            if heading.startswith("Revisão do capítulo"):
                mode = "review"
                continue
            if heading.startswith("Fontes de estudo da parte"):
                close_review()
                mode = "sources"
                continue
            if mode == "review":
                close_review()
            mode = "body"
            if upcoming == "table":
                # O manual repete um título de seção antes da tabela: é o título da tabela.
                ensure_section()
                caption = heading
                continue
            ensure_chapter()
            section = {"heading": heading, "blocks": []}
            chapter["sections"].append(section)  # type: ignore[index]
            continue

        if kind == "table":
            if mode in {"review", "sources"}:
                mode = "body"
            target = ensure_section()
            rows = element["rows"]
            header = fix_header(rows[0], rows[1:])
            target["blocks"].append({"type": "table", "caption": caption or "", "header": header, "rows": rows[1:]})
            caption = None
            continue

        text = element["text"]
        if mode == "summary" and part is not None:
            part["summary"] = f"{part['summary']} {text}".strip()
            if upcoming in {"heading", "table"}:
                mode = "body"
            continue
        if mode == "review":
            pending_review.append(text)
            continue
        if mode == "sources":
            part["sources"] = f"{part['sources']} {text}".strip()
            continue
        if kind == "italic" and text.startswith("Objetivo do capítulo:") and chapter is not None:
            chapter["objective"] = text.removeprefix("Objetivo do capítulo:").strip()
            continue
        if kind == "callout":
            body = text.removeprefix(CALLOUT_LABEL).strip()
            ensure_section()["blocks"].append({"type": "callout", "text": body})
            continue
        ensure_section()["blocks"].append(block_of_paragraph(text))

    close_review()
    return parts


def locate_theory(doc: pymupdf.Document) -> tuple[int, int]:
    first = last = -1
    for index, page in enumerate(doc):
        text = page.get_text()
        if first < 0 and "Objetivo do capítulo" in text and "1.1 " in text:
            first = index
        if re.search(r"^Parte 30\s+Cadernos", text, re.MULTILINE) and index > first >= 0:
            last = index - 1
            break
    if first < 0 or last < 0:
        raise SystemExit("Não encontrei o início da teoria (Parte 1) ou o começo da Parte 30 no PDF.")
    return first, last


def tokens(text: str) -> list[str]:
    return [token for token in (re.sub(r"[^\wà-úÀ-Ú]", "", word.lower()) for word in text.split()) if token]


def part_text(part: dict) -> str:
    """Reconstrói o texto da Parte, com os rótulos fixos do livro que viraram estrutura."""

    pieces = [f"Parte {part['number']} {part['name']}", part["summary"]]
    if part["sources"]:
        pieces.append(f"Fontes de estudo da parte {part['sources']}")
    for chapter in part["chapters"]:
        pieces += [chapter["number"], chapter["title"]]
        if chapter["objective"]:
            pieces.append(f"Objetivo do capítulo: {chapter['objective']}")
        if chapter["review"]:
            pieces += [f"Revisão do capítulo {chapter['number']}", *(f"• {item}" for item in chapter["review"])]
        for section in chapter["sections"]:
            pieces.append(section["heading"])
            for block in section["blocks"]:
                if block["type"] == "table":
                    pieces += [block["caption"], *block["header"], *(cell for row in block["rows"] for cell in row)]
                elif block["type"] == "definition":
                    pieces.append(f"{block['term']} {block['text']}")
                elif block["type"] == "callout":
                    pieces.append(f"{CALLOUT_LABEL} {block['text']}")
                else:
                    pieces.append(block["text"])
    return " ".join(pieces)


def coverage(doc: pymupdf.Document, first: int, last: int, parts: list[dict]) -> float:
    """Fração das palavras do corpo do PDF que aparecem no JSON (rótulos fixos do livro não contam)."""

    from collections import Counter

    pdf: Counter[str] = Counter()
    for index in range(first, last + 1):
        for x0, y0, x1, y1, word, *_ in doc[index].get_text("words"):
            if HEADER_LIMIT <= y0 <= FOOTER_LIMIT:
                pdf.update(tokens(word))
    kept: Counter[str] = Counter()
    for part in parts:
        kept.update(tokens(part_text(part)))
    missing = sum((pdf - kept).values())
    return 1 - missing / sum(pdf.values())


def report(parts: list[dict], warnings: list[str]) -> None:
    print(f"{'Parte':<7}{'cap':>4}{'seç':>5}{'par':>5}{'def':>5}{'cal':>5}{'tab':>5}{'rev':>5}  nome")
    for part in parts:
        counts = {"paragraph": 0, "definition": 0, "callout": 0, "table": 0}
        sections = 0
        review = 0
        for chapter in part["chapters"]:
            review += len(chapter["review"])
            for section in chapter["sections"]:
                sections += 1
                for block in section["blocks"]:
                    counts[block["type"]] += 1
        print(
            f"{part['number']:<7}{len(part['chapters']):>4}{sections:>5}{counts['paragraph']:>5}"
            f"{counts['definition']:>5}{counts['callout']:>5}{counts['table']:>5}{review:>5}  {part['name']}"
        )
    if warnings:
        print(f"\n{len(warnings)} aviso(s):")
        for warning in warnings[:40]:
            print(" -", warning)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="pasta onde gravar parte-NN.json")
    args = parser.parse_args()

    doc = pymupdf.open(args.pdf)
    first, last = locate_theory(doc)
    # A Parte 29 (Revisão Estratégica) termina antes da Parte 30; `last` já é a página anterior a ela.
    warnings: list[str] = []
    elements = merge_page_breaks(elements_of(doc, first, last, warnings))
    parts = build_parts(elements, warnings)

    args.out.mkdir(parents=True, exist_ok=True)
    for part in parts:
        path = args.out / f"parte-{part['number']:02d}.json"
        path.write_text(json.dumps(part, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report(parts, warnings)
    ratio = coverage(doc, first, last, parts)
    print(f"\nCobertura do texto do PDF no JSON: {ratio:.2%}")
    if ratio < MIN_COVERAGE:
        print(f"Cobertura abaixo de {MIN_COVERAGE:.1%}: revise os avisos antes de importar.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
