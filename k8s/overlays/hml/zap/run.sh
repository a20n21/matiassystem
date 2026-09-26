#!/bin/sh
# Roda o ZAP baseline e publica o resultado no GitHub (commit status).
# O Job termina com o código do ZAP: falha ao publicar nunca esconde o resultado.
cp /scripts/rules.tsv /zap/wrk/rules.tsv

# -c: regras FAIL/IGNORE; -I: WARN não falha (só FAIL)
zap-baseline.py -t "$TARGET" -c rules.tsv -I > /zap/wrk/zap.log 2>&1
code=$?
cat /zap/wrk/zap.log

python3 /scripts/post_status.py "$code" /zap/wrk/zap.log
exit "$code"
