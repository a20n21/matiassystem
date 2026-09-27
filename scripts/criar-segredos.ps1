# Cria os Secrets do app em cada ambiente (fora do Git):
#   matiassystem-db   senha do Postgres: gerada aleatoriamente, criada UMA vez e nunca sobrescrita
#                     (o Postgres só lê a senha na primeira inicialização do banco)
#   matiassystem-app  seu usuário e o hash scrypt da sua senha (pode ser trocado quando quiser)
#
# Uso (PowerShell, na raiz do projeto):
#   .\scripts\criar-segredos.ps1                       # dev, hml e prod
#   .\scripts\criar-segredos.ps1 -Ambientes prod       # só um ambiente (ex.: trocar a senha do prod)
param(
    [string[]]$Ambientes = @('dev', 'hml', 'prod'),
    [string]$Usuario = 'matias'
)
$ErrorActionPreference = 'Stop'

if ((kubectl config current-context) -ne 'kind-matiassystem') {
    throw "Contexto do kubectl não é kind-matiassystem. Rode: kubectl config use-context kind-matiassystem"
}

# O hash é gerado pelo próprio código do app (mesmo algoritmo que confere o login)
Write-Host "Preparando a imagem do app para gerar o hash da senha..." -ForegroundColor Cyan
docker build -q -t matiassystem:ferramentas (Join-Path $PSScriptRoot '..\app') | Out-Null

function Novo-Hash([Security.SecureString]$Senha) {
    $texto = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Senha))
    # UTF-8 sem BOM: senão o PowerShell envia um caractere invisível antes da senha
    $encodingAnterior = $OutputEncoding
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    try {
        # Senha pela entrada padrão: não aparece na lista de processos nem no histórico
        $hash = $texto | docker run --rm -i --entrypoint node matiassystem:ferramentas dist/hash-password.js
    } finally {
        $OutputEncoding = $encodingAnterior
        Remove-Variable texto
    }
    if (-not ($hash -like 'scrypt$*')) { throw 'Falha ao gerar o hash da senha' }
    return $hash
}

function Nova-SenhaAleatoria {
    $bytes = [byte[]]::new(24)
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$senhaAnterior = $null
foreach ($amb in $Ambientes) {
    $ns = "matiassystem-$amb"
    Write-Host "`n=== $amb ($ns) ===" -ForegroundColor Cyan
    kubectl create namespace $ns --dry-run=client -o yaml | kubectl apply -f - | Out-Null

    # Banco: só cria se não existir
    if (kubectl -n $ns get secret matiassystem-db --ignore-not-found) {
        Write-Host "matiassystem-db já existe (senha do banco mantida)."
    } else {
        kubectl -n $ns create secret generic matiassystem-db `
            --from-literal=POSTGRES_USER=matiassystem `
            --from-literal=POSTGRES_DB=matiassystem `
            --from-literal=POSTGRES_PASSWORD=(Nova-SenhaAleatoria) | Out-Null
        Write-Host "matiassystem-db criado (senha aleatória, você não precisa saber)."
    }

    # Login do app
    $prompt = "Senha de login do app em $amb"
    if ($senhaAnterior) { $prompt += " (Enter = mesma do ambiente anterior)" }
    $senha = Read-Host $prompt -AsSecureString
    if ($senha.Length -eq 0) {
        if (-not $senhaAnterior) { throw 'Senha vazia' }
        $senha = $senhaAnterior
    } elseif ($senha.Length -lt 8) {
        throw 'Use pelo menos 8 caracteres'
    }
    $senhaAnterior = $senha
    $hash = Novo-Hash $senha
    kubectl -n $ns create secret generic matiassystem-app `
        --from-literal=APP_USER=$Usuario --from-literal=APP_PASSWORD_HASH=$hash `
        --dry-run=client -o yaml | kubectl apply -f - | Out-Null
    Write-Host "matiassystem-app gravado (usuário: $Usuario)."

    # Se o app já estiver rodando, recria os pods para lerem a senha nova.
    # (rollout restart mudaria o template, e o Argo CD desfaria a mudança)
    if (kubectl -n $ns get pods -l app=matiassystem -o name) {
        kubectl -n $ns delete pods -l app=matiassystem --wait=false | Out-Null
        Write-Host "Pods do app recriados para usar a senha nova."
    }
}
Write-Host "`nPronto." -ForegroundColor Green
