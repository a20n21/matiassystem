# matiassystem

Portal de estudos rodando num Kubernetes local (kind), com GitOps via Argo CD.

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

1. **Local:** `git checkout -b minha-mudanca` e `docker compose up -d`. Edite `app/html/` e veja em http://localhost:8081 (F5, sem rebuild).
2. **PR:** push da branch e abra um PR. O `pr-check` roda Kustomize, build + Trivy e gitleaks.
3. **Dev:** o merge no `main` gera a imagem `ghcr.io/a20n21/matiassystem:<commit>` e o Argo CD atualiza o dev.
4. **Homologação:** automática. O bot abre o PR de promoção, espera o `pr-check` e faz o merge.
5. **Produção:** o `promote` pausa pedindo aprovação (Actions → execução → **Review deployments**). Aprovado, o bot abre o PR, espera o `pr-check` e faz o merge.

O único passo humano depois do merge do código é a **aprovação de prod**. O `promote` também pode ser disparado à mão (Actions → promote → Run workflow).

Rollback: `git revert` do PR de promoção.

## Segurança

| Camada | Ferramenta | Onde | Bloqueia |
|---|---|---|---|
| Segredos no código | gitleaks | `pr-check` / secrets | PR |
| CVEs da imagem | Trivy image | `pr-check` / build-scan | PR |
| Configuração dos manifestos | Trivy config | `pr-check` / manifests | PR |
| Políticas do cluster (teste offline) | Kyverno CLI | `pr-check` / manifests | PR |
| Políticas do cluster (admissão) | Kyverno | cluster, namespaces `matiassystem-*` | `kubectl apply` / sync |
| Ataque à aplicação rodando (DAST) | OWASP ZAP | Job PostSync na hml | Sync da hml |

**Antes de aprovar prod:** no Argo CD, confira se o último sync de `matiassystem-hml` terminou com sucesso. Se o Job `zap-baseline` falhou, não aprove; os achados estão nos logs do Job:

```powershell
kubectl -n matiassystem-hml logs job/zap-baseline
```

Exceções ficam em `.trivyignore.yaml` (Trivy) e `k8s/overlays/hml/zap/rules.tsv` (ZAP), sempre com justificativa.

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
