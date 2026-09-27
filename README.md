# matiassystem

Portal de estudos rodando num Kubernetes local (kind), com GitOps via Argo CD.

App pessoal com login: trilhas, estudos (cursos) com checklist de aulas assistidas,
anotações em Markdown, cronômetro de sessões de estudo e roadmap.

| Parte | Tecnologia |
|---|---|
| Frontend | React + TypeScript (Vite) — `app/web` |
| Backend | Node.js + Fastify + TypeScript — `app/server` |
| Banco | PostgreSQL 17 (um por ambiente, StatefulSet com volume) |
| Imagem | Multistage: build do front e do back, runtime Node sem root e sem npm |

## Ambientes

| Ambiente | Endereço | Atualização |
|---|---|---|
| dev | http://dev.matiassystem.localhost | Automática a cada merge no `main` |
| hml | http://hml.matiassystem.localhost | Automática depois do dev (PR aberto e mergeado pelo bot) |
| prod | http://matiassystem.localhost | Automática depois do hml, **após aprovação** no Environment `production` |
| Argo CD | http://argocd.localhost | — |

## Fluxo de desenvolvimento

```
branch → docker compose (local) → PR (pr-check) → merge → dev → hml → ⏸ aprovação → prod
```

1. **Local:** `git checkout -b minha-mudanca` e `docker compose up -d`. Abra http://localhost:8081
   (usuário `matias`, senha `matias123`, só local). Mudanças em `app/web/src` aparecem sozinhas;
   em `app/server/src` a API reinicia sozinha. Migrações novas: `app/server/migrations/NNN_nome.sql`.
2. **PR:** push da branch e abra um PR. O `pr-check` roda Kustomize, build + Trivy e gitleaks.
3. **Dev:** o merge no `main` gera a imagem `ghcr.io/a20n21/matiassystem:<commit>` e o Argo CD atualiza o dev.
4. **Homologação:** automática. O bot abre o PR de promoção, espera o `pr-check` e faz o merge.
5. **Produção:** o `promote` pausa pedindo aprovação (Actions → execução → **Review deployments**). Aprovado, o bot abre o PR, espera o `pr-check` e faz o merge.

O único passo humano depois do merge do código é a **aprovação de prod**. O `promote` também pode ser disparado à mão (Actions → promote → Run workflow).

Rollback: `git revert` do PR de promoção.

## Senhas e dados

Cada ambiente tem os próprios Secrets (fora do Git), criados por:

```powershell
.\scripts\criar-segredos.ps1                   # dev, hml e prod
.\scripts\criar-segredos.ps1 -Ambientes prod   # trocar a senha de login do prod
```

- `matiassystem-db`: senha do Postgres, aleatória, criada uma única vez (nunca sobrescrita).
- `matiassystem-app`: usuário e hash scrypt da senha de login (a senha em si não é guardada).

O banco fica num volume do cluster local: **apagar o cluster apaga os dados**.
Use **Configurações → Exportar backup** de vez em quando.

## Segurança

| Camada | Ferramenta | Onde | Bloqueia |
|---|---|---|---|
| Segredos no código | gitleaks | `pr-check` / secrets | PR |
| CVEs da imagem | Trivy image | `pr-check` / build-scan | PR |
| Configuração dos manifestos | Trivy config | `pr-check` / manifests | PR |
| Políticas do cluster (teste offline) | Kyverno CLI | `pr-check` / manifests | PR |
| Políticas do cluster (admissão) | Kyverno | cluster, namespaces `matiassystem-*` | `kubectl apply` / sync |
| Ataque à aplicação rodando (DAST) | OWASP ZAP | Job PostSync na hml | Sync da hml **e promoção para prod** |

**ZAP como gate de prod:** o Job do ZAP publica o resultado no GitHub como commit status
`security/zap-hml`, no commit da versão testada (lida de `/version.txt`). O `guard` do
workflow `promote` (prod) espera esse status: com `success` o pedido de aprovação é criado;
com `failure`, ou sem resultado em 25 min, a promoção para e ninguém recebe o pedido.

Achados do último scan:

```powershell
kubectl -n matiassystem-hml logs job/zap-baseline
```

O Job usa o Secret `zap-github-status` (token fine-grained com *Commit statuses: Read and write*
e *Contents: Read-only* só neste repositório), criado à mão ou pelo `bootstrap.ps1`.

Exceções ficam em `.trivyignore.yaml` (Trivy) e `k8s/overlays/hml/zap/rules.tsv` (ZAP), sempre com justificativa.

## Estrutura

```
app/web/               frontend React (Vite)
app/server/            API Fastify + migrações SQL (migrations/)
scripts/               criar-segredos.ps1 (senhas por ambiente)
k8s/base/              Deployment, Service, Ingress
k8s/overlays/          dev, hml, prod (Kustomize)
k8s/argocd/root.yaml   app of apps (único manifesto aplicado à mão)
k8s/argocd/apps/       Applications: traefik, metrics-server, matiassystem-*
k8s/platform/          values dos charts Helm
bootstrap.ps1          recria o ambiente do zero
```

## Recriar o ambiente

```powershell
.\bootstrap.ps1
```

Requer Docker Desktop, kind, kubectl e Helm.
