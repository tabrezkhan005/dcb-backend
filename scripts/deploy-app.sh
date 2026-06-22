#!/usr/bin/env bash
# Run ON the EC2 instance after Terraform, from /opt/dcb-backend (or sync code here first).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dcb-backend}"
cd "$APP_DIR"

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build
npm run db:generate

echo "==> Database migrations"
npx prisma migrate deploy

echo "==> Seed (first run only — safe to re-run)"
npm run db:seed || true

echo "==> PM2"
mkdir -p logs
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | bash || true

echo "==> Health"
sleep 3
curl -sf "http://127.0.0.1:3000/health" && echo ""

echo "Done. API should be reachable via CloudFront (see terraform output api_url)."
