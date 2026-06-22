# Quick S3 check using credentials from .env (exports bucket).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$bucket = $env:S3_EXPORTS_BUCKET
$region = $env:AWS_REGION
if ([string]::IsNullOrWhiteSpace($bucket)) {
  Write-Error "S3_EXPORTS_BUCKET is not set in .env"
}

$key = "health-check/test-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$tmp = Join-Path $env:TEMP "dcb-s3-test.txt"
"DCB S3 connectivity test" | Set-Content -Path $tmp -Encoding utf8

Write-Host "Uploading to s3://$bucket/$key ($region)..."
aws s3 cp $tmp "s3://$bucket/$key" --region $region --content-type "text/plain"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Upload failed. Check AWS keys and IAM policy DcbS3Policy."
}

Write-Host "OK — listing health-check/:"
aws s3 ls "s3://$bucket/health-check/" --region $region
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
