"""Padroniza as alternativas do banco de questões: primeira letra maiúscula e ponto final.

Idempotente: rodar de novo não muda o que já está padronizado. Roda na VM, com o Python do
ambiente da API (usa psycopg), e nunca imprime o conteúdo das questões.

    python normalize_options.py --env-file /opt/vira-ai/apps/api/.env --dry-run
    python normalize_options.py --env-file /opt/vira-ai/apps/api/.env
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

LETTERS = "abcde"


def normalize_option(text: str) -> str:
    value = text.strip()
    if not value:
        return value
    if value[0].islower():
        value = value[0].upper() + value[1:]
    if value[-1] in ":;,":
        return value[:-1] + "."
    if value[-1] not in ".?!":
        value += "."
    return value


def database_url(env_file: str | None) -> str:
    if env_file:
        for line in Path(env_file).read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL não encontrada (use --env-file ou a variável de ambiente).")
    return url


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--env-file", help="arquivo .env com DATABASE_URL")
    parser.add_argument("--dry-run", action="store_true", help="só conta o que mudaria")
    args = parser.parse_args()

    import psycopg

    columns = ", ".join(f"option_{letter}" for letter in LETTERS)
    with psycopg.connect(database_url(args.env_file)) as connection:
        rows = connection.execute(f"SELECT id, {columns} FROM concursos_questions").fetchall()
        changed_questions = 0
        changed_options = 0
        for question_id, *options in rows:
            updates = {}
            for letter, current in zip(LETTERS, options):
                if current is None:
                    continue
                fixed = normalize_option(current)
                if fixed != current:
                    updates[f"option_{letter}"] = fixed
            if not updates:
                continue
            changed_questions += 1
            changed_options += len(updates)
            if not args.dry_run:
                assignments = ", ".join(f"{column} = %s" for column in updates)
                connection.execute(
                    f"UPDATE concursos_questions SET {assignments} WHERE id = %s",
                    [*updates.values(), question_id],
                )
        if args.dry_run:
            connection.rollback()

    verb = "seriam alteradas" if args.dry_run else "alteradas"
    print(f"{len(rows)} questões lidas; {changed_options} alternativas {verb} em {changed_questions} questões.")


if __name__ == "__main__":
    main()
