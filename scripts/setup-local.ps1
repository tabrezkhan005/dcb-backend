# Local setup: Docker (Postgres + Redis), Prisma schema, seed data.
# Prerequisite: Docker Desktop running.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> DCB backend local setup" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Write-Error "Missing .env — copy .env.example and configure it."
}

Write-Host "==> Starting Postgres + Redis..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Error @"
Docker failed. Start Docker Desktop, wait until it is running, then run:
  docker compose up -d
"@
}

Write-Host "==> Waiting for Postgres..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  docker compose exec -T postgres pg_isready -U postgres -d dcb_ap 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  Write-Error "Postgres did not become ready in time."
}

Write-Host "==> Applying schema + seed..."
npm run db:generate
npx prisma db push
npm run db:seed

Write-Host ""
Write-Host "Local stack is ready." -ForegroundColor Green
Write-Host "  API:           npm run dev"
Write-Host "  Export worker: npm run worker:export"
Write-Host "  Receipt worker: npm run worker:receipt"
Write-Host ""
Write-Host "DATABASE_URL should be:"
Write-Host "  postgresql://postgres:dcb_local_dev@localhost:5433/dcb_ap?schema=public"
