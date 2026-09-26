"""Publica o resultado do ZAP como commit status no GitHub (contexto security/zap-hml).

O commit é o da versão que estava rodando na hml durante o scan (lida de /version.txt),
não o commit do manifesto. O guard do workflow "promote" (prod) espera por este status.

Nunca falha o Job: qualquer erro aqui só gera um aviso no log.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

CONTEXT = "security/zap-hml"

# O que costuma causar cada erro, por etapa (o token é fine-grained, só deste repositório)
HINTS = {
    "ler o commit": {
        401: "token inválido ou expirado: gere outro e recrie o Secret zap-github-status",
        403: "token sem acesso ao repositório ou sem 'Contents: Read-only'",
        404: "token sem acesso ao repositório (Repository access) ou commit inexistente",
        422: "a versão em /version.txt não é um commit deste repositório",
    },
    "gravar o status": {
        401: "token inválido ou expirado: gere outro e recrie o Secret zap-github-status",
        403: "token sem 'Commit statuses: Read and write' (só leitura não basta)",
        404: "token sem acesso ao repositório (Repository access)",
    },
}


def explain(step: str, error: Exception) -> str:
    """Mensagem de erro com a etapa, o HTTP, a resposta do GitHub e a causa provável."""
    if not isinstance(error, urllib.error.HTTPError):
        return f"falha ao {step}: {error}"
    try:
        detail = json.load(error).get("message", "")
    except Exception:
        detail = ""
    hint = HINTS.get(step, {}).get(error.code, "")
    parts = [f"falha ao {step}: HTTP {error.code}"]
    if detail:
        parts.append(f"GitHub: {detail}")
    if hint:
        parts.append(f"provável causa: {hint}")
    return " | ".join(parts)


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
    except Exception as e:
        print(f"AVISO: {explain('ler o commit', e)}. Resultado não publicado.")
        return

    try:
        call("POST", f"{api}/statuses/{sha}",
             {"state": state, "context": CONTEXT, "description": description[:140]})
    except Exception as e:
        print(f"AVISO: {explain('gravar o status', e)}. Resultado não publicado.")
        return
    print(f"Status publicado: {CONTEXT}={state} no commit {sha[:7]} ({description})")


if __name__ == "__main__":
    main()
