"""Publica o resultado do ZAP como commit status no GitHub (contexto security/zap-hml).

O commit é o da versão que estava rodando na hml durante o scan (lida de /version.txt),
não o commit do manifesto. O guard do workflow "promote" (prod) espera por este status.

Nunca falha o Job: qualquer erro aqui só gera um aviso no log.
"""
import json
import os
import re
import sys
import urllib.request

CONTEXT = "security/zap-hml"


def main() -> None:
    zap_code = int(sys.argv[1])
    log = open(sys.argv[2], encoding="utf-8", errors="replace").read()
    target = os.environ["TARGET"].rstrip("/")
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ.get("GITHUB_TOKEN", "")

    if not token:
        print("AVISO: sem GITHUB_TOKEN (Secret zap-github-status); resultado não publicado.")
        return

    try:
        with urllib.request.urlopen(f"{target}/version.txt", timeout=10) as r:
            version = r.read().decode().strip()
    except Exception as e:  # imagem antiga, sem version.txt
        print(f"AVISO: não foi possível ler {target}/version.txt ({e}); resultado não publicado.")
        return
    if not re.fullmatch(r"[0-9a-f]{7,40}", version):
        print(f"AVISO: versão '{version}' não é um commit; resultado não publicado.")
        return

    api = f"https://api.github.com/repos/{repo}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "matiassystem-zap-hml",
    }

    def call(method: str, url: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)

    summary = re.search(r"FAIL-NEW: (\d+).*?PASS: (\d+)", log)
    if zap_code == 0:
        state = "success"
    elif zap_code == 1:
        state = "failure"
    else:
        state = "error"
    description = (
        f"ZAP na hml: {summary.group(1)} FAIL, {summary.group(2)} PASS"
        if summary else f"ZAP terminou com código {zap_code}"
    )

    try:
        sha = call("GET", f"{api}/commits/{version}")["sha"]
        call("POST", f"{api}/statuses/{sha}",
             {"state": state, "context": CONTEXT, "description": description[:140]})
        print(f"Status publicado: {CONTEXT}={state} no commit {sha[:7]} ({description})")
    except Exception as e:
        print(f"AVISO: falha ao publicar status no GitHub ({e}).")


if __name__ == "__main__":
    main()
