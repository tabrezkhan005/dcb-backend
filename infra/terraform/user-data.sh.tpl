#!/bin/bash
set -euxo pipefail

APP_DIR="${app_dir}"
exec > /var/log/dcb-user-data.log 2>&1

dnf update -y
dnf install -y git jq

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_${node_major}.x | bash -
dnf install -y nodejs
npm install -g pm2

mkdir -p "$APP_DIR/logs"
chown -R ec2-user:ec2-user "$APP_DIR"

cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=${database_url}
REDIS_URL=${redis_url}
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}
CORS_ORIGINS=${cors_origins}
AWS_REGION=${aws_region}
S3_EXPORTS_BUCKET=${s3_exports_bucket}
S3_RECEIPTS_BUCKET=${s3_receipts_bucket}
EOF

chown ec2-user:ec2-user "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

%{ if app_repo_url != "" ~}
sudo -u ec2-user bash -lc "cd $APP_DIR && if [ ! -d .git ]; then git clone ${app_repo_url} .; else git pull; fi"
sudo -u ec2-user bash -lc "cd $APP_DIR && npm ci && npm run build && npm run db:generate && npx prisma migrate deploy && npm run db:seed"
sudo -u ec2-user bash -lc "cd $APP_DIR && pm2 start ecosystem.config.js && pm2 save"
%{ else ~}
echo "No app_repo_url — deploy code to $APP_DIR and run scripts/deploy-app.sh"
%{ endif ~}

systemctl enable pm2-ec2-user 2>/dev/null || true
