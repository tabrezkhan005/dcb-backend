# Use existing PostgreSQL on port 5432 (skip Docker Postgres).
# You will be prompted for the postgres user password once.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$dbName = "dcb_ap"
$secure = Read-Host "PostgreSQL password for user 'postgres'" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$pgPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
$env:PGPASSWORD = $pgPass

$exists = psql -U postgres -h localhost -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = '$dbName'" 2>$null
if ([string]::IsNullOrWhiteSpace($exists)) {
  psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE $dbName;"
}

$url = "postgresql://postgres:$([uri]::EscapeDataString($pgPass))@localhost:5432/${dbName}?schema=public"
Write-Host "Set DATABASE_URL in .env to:" -ForegroundColor Yellow
Write-Host $url

$lines = Get-Content .env
$out = $lines | ForEach-Object {
  if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=$url" } else { $_ }
}
if (-not ($out -match '^DATABASE_URL=')) { $out += "DATABASE_URL=$url" }
$out | Set-Content .env -Encoding utf8

npm run db:generate
npx prisma db push
npm run db:seed
Write-Host "Schema applied. Start Redis (Docker: docker compose up -d redis) then npm run dev" -ForegroundColor Green
