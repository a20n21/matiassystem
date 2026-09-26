# matiassystem

Portal de estudos rodando num Kubernetes local (kind), com GitOps via Argo CD.

## Ambientes

| Ambiente | Endereço | Atualização |
|---|---|---|
| dev | http://dev.matiassystem.localhost | Automática a cada merge no `main` |
| hml | http://hml.matiassystem.localhost | Promoção via PR (workflow `promote`) |
| prod | http://matiassystem.localhost | Promoção via PR + aprovação no Environment `production` |
| Argo CD | http://argocd.localhost | — |

## Fluxo de desenvolvimento

```
branch → docker compose (local) → PR (pr-check) → merge → dev → promote hml → promote prod
```

1. **Local:** `git checkout -b minha-mudanca` e `docker compose up -d`. Edite `app/html/` e veja em http://localhost:8081 (F5, sem rebuild).
2. **PR:** push da branch e abra um PR. O `pr-check` roda Kustomize, build + Trivy e gitleaks.
3. **Dev:** o merge no `main` gera a imagem `ghcr.io/a20n21/matiassystem:<commit>` e o Argo CD atualiza o dev.
4. **Homologação:** Actions → `promote` → `hml`. Revise e faça merge do PR aberto.
5. **Produção:** Actions → `promote` → `prod`. Aprove o Environment `production`, revise e faça merge do PR.

Rollback: `git revert` do PR de promoção.

## Estrutura

```
app/                   site (nginx) — html/ é o conteúdo
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
