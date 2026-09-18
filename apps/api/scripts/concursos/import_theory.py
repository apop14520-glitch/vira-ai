"""Importa para a API a teoria extraída por `extract_manual.py` (um arquivo parte-NN.json por Parte).

O tópico de cada Parte é encontrado pelo número no nome ("Parte 7 — ..."). A importação substitui
a teoria inteira do tópico, então repetir o comando (ou importar uma edição nova) é seguro.

Exemplos:
    # local, sem autenticação (ambiente de desenvolvimento)
    python import_theory.py saida/ --api http://127.0.0.1:8000

    # no servidor: o token de admin é lido do .env e nunca é impresso
    python3 import_theory.py saida/ --env-file /opt/vira-ai/apps/api/.env --dry-run
    python3 import_theory.py saida/ --env-file /opt/vira-ai/apps/api/.env --create-missing
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PART_NUMBER = re.compile(r"^Parte\s+(\d+)\b", re.IGNORECASE)


def read_token(env_file: Path | None) -> str | None:
    if env_file is None:
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("ADMIN_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit(f"ADMIN_ACCESS_TOKEN não encontrado em {env_file}")


class Api:
    def __init__(self, base: str, token: str | None) -> None:
        self.base = base.rstrip("/") + "/api/v1/concursos"
        self.token = token

    def call(self, method: str, path: str, payload: object | None = None) -> object:
        data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if self.token:
            request.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:500]
            raise SystemExit(f"{method} {path} falhou: HTTP {error.code} {detail}") from error
        return json.loads(body) if body else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="pasta com os parte-NN.json")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="endereço da API (padrão: %(default)s)")
    parser.add_argument("--env-file", type=Path, help=".env do servidor, de onde sai o ADMIN_ACCESS_TOKEN")
    parser.add_argument("--create-missing", action="store_true", help="cria o tópico da Parte quando ele não existe")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o que faria")
    args = parser.parse_args()

    files = sorted(args.folder.glob("parte-*.json"))
    if not files:
        raise SystemExit(f"Nenhum parte-*.json em {args.folder}")

    api = Api(args.api, read_token(args.env_file))
    topics_by_part: dict[int, dict] = {}
    for topic in api.call("GET", "/topics"):  # type: ignore[union-attr]
        match = PART_NUMBER.match(topic["name"])
        if match:
            topics_by_part[int(match.group(1))] = topic

    imported = skipped = 0
    for path in files:
        part = json.loads(path.read_text(encoding="utf-8"))
        number = part["number"]
        topic = topics_by_part.get(number)
        label = f"Parte {number} — {part['name']}"
        if topic is None and args.create_missing:
            if args.dry_run:
                print(f"[dry-run] criaria o tópico: {label}")
                skipped += 1
                continue
            topic = api.call("POST", "/topics", {"name": label, "description": part["summary"][:500]})  # type: ignore[assignment]
            print(f"tópico criado: {label}")
        if topic is None:
            print(f"AVISO: não há tópico para {label}; use --create-missing para criá-lo", file=sys.stderr)
            skipped += 1
            continue
        document = {key: part[key] for key in ("summary", "sources", "chapters")}
        if args.dry_run:
            print(f"[dry-run] Parte {number} -> '{topic['name']}': {len(part['chapters'])} capítulos")
            skipped += 1
            continue
        result = api.call("PUT", f"/topics/{topic['id']}/theory", document)
        print(f"Parte {number} -> '{topic['name']}': {result['chapters']} capítulos")  # type: ignore[index]
        imported += 1

    print(f"\n{imported} Partes importadas, {skipped} ignoradas ou só simuladas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
