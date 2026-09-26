# Recria o ambiente do zero: cluster kind + Argo CD + credenciais + app of apps.
# Todo o resto (Traefik, metrics-server, matiassystem dev/prod) o Argo CD instala a partir do Git.
# Uso (PowerShell, na raiz do projeto): .\bootstrap.ps1
$ErrorActionPreference = 'Stop'

$ClusterName  = 'matiassystem'
$ArgoChart    = '10.9.2'
$RepoUrl      = 'git@github.com:a20n21/matiassystem.git'
$GhcrUser     = 'a20n21'
$AppNamespaces = 'matiassystem-dev', 'matiassystem-hml', 'matiassystem-prod'

# 1. Cluster
if (-not (kind get clusters | Select-String -SimpleMatch $ClusterName)) {
    kind create cluster --config kind-cluster.yaml
}
kubectl config use-context "kind-$ClusterName" | Out-Null

# 2. Argo CD (único componente instalado fora do Git)
helm repo add argo https://argoproj.github.io/argo-helm 2>$null | Out-Null
helm upgrade --install argocd argo/argo-cd --version $ArgoChart -n argocd --create-namespace `
    -f k8s/platform/argocd-values.yaml --wait --timeout 5m

# 3. Deploy key para o Argo CD ler o repositório privado
if (-not (kubectl -n argocd get secret repo-matiassystem --ignore-not-found)) {
    $key = Join-Path $env:TEMP "argocd-deploy-key-$(Get-Random)"
    ssh-keygen -t ed25519 -N '""' -C "argocd@$ClusterName-kind" -f $key -q
    kubectl -n argocd create secret generic repo-matiassystem `
        --from-literal=type=git --from-literal=url=$RepoUrl --from-file=sshPrivateKey=$key
    kubectl -n argocd label secret repo-matiassystem argocd.argoproj.io/secret-type=repository
    Write-Host "`nCadastre esta chave em GitHub > Settings > Deploy keys (somente leitura), substituindo a antiga:" -ForegroundColor Yellow
    Get-Content "$key.pub"
    Remove-Item $key, "$key.pub"
    Read-Host "`nEnter depois de cadastrar"
}

# 4. Credencial do GHCR em cada namespace da aplicação
foreach ($ns in $AppNamespaces) {
    kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply -f - | Out-Null
}
if (-not (kubectl -n $AppNamespaces[0] get secret ghcr-pull --ignore-not-found)) {
    $t = Read-Host "Token do GHCR (classic, somente read:packages)" -AsSecureString
    $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($t))
    foreach ($ns in $AppNamespaces) {
        kubectl -n $ns create secret docker-registry ghcr-pull `
            --docker-server=ghcr.io --docker-username=$GhcrUser --docker-password=$p
    }
    Remove-Variable t, p
}

# 5. Token para o ZAP da hml publicar o resultado no GitHub (commit status)
if (-not (kubectl -n matiassystem-hml get secret zap-github-status --ignore-not-found)) {
    Write-Host "`nToken fine-grained do GitHub: repositório matiassystem, 'Commit statuses: Read and write' e 'Contents: Read-only'." -ForegroundColor Yellow
    $t = Read-Host "Token do ZAP (Enter para pular: o prod não poderá ser promovido)" -AsSecureString
    $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($t))
    if ($p) {
        kubectl -n matiassystem-hml create secret generic zap-github-status --from-literal=token=$p
    }
    Remove-Variable t, p
}

# 6. App of apps: a partir daqui o Argo CD assume
kubectl apply -f k8s/argocd/root.yaml
Write-Host "`nPronto. Acompanhe em http://argocd.localhost (usuário admin). Senha:" -ForegroundColor Green
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" |
    ForEach-Object { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
