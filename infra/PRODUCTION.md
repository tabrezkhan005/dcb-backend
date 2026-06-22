# DCB AP — AWS production stack

Deploys: **VPC → RDS PostgreSQL → ElastiCache Redis → EC2 (PM2) → ALB → CloudFront**.

S3 buckets and IAM for S3 are **not** recreated; use your existing buckets and the EC2 instance role (no access keys on the server).

## Architecture

```
Phones (Expo) ──HTTPS──► CloudFront ──HTTP──► ALB ──► EC2:3000 (Fastify + workers)
                                              │
                    RDS PostgreSQL ◄──────────┤
                    ElastiCache Redis ◄───────┘
                    S3 (exports / receipts) ◄── IAM role on EC2
```

## Prerequisites

1. **AWS CLI** configured (`aws configure`) for account **WAQF**, region **ap-south-2**.
2. **Terraform** ≥ 1.5 — [terraform.io/downloads](https://www.terraform.io/downloads)
3. **EC2 key pair** in `ap-south-2`: AWS Console → EC2 → Key pairs → Create → name e.g. `dcb-ap-key`.
4. S3 buckets already created (`waqf-dcb-exports-ap-south-2`, `waqf-dcb-receipts-ap-south-2`).
5. **Remove** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from production `.env` on EC2 (instance role is used).

## Step 1 — Configure Terraform variables

```powershell
cd D:\dcb-backend\infra\terraform
copy terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

- `ec2_key_name` — your key pair name
- `jwt_secret` / `jwt_refresh_secret` — strong random strings (32+ chars)
- `ssh_cidr_blocks` — your public IP `/32` (not `0.0.0.0/0` for real prod)
- `s3_*_bucket` — your bucket names

## Step 2 — Apply infrastructure

```powershell
terraform init
terraform plan
terraform apply
```

Takes ~15–20 minutes (RDS + ElastiCache are slow).

Save outputs:

```powershell
terraform output api_url
terraform output api_v1_url
terraform output ec2_public_ip
```

## Step 3 — Deploy application code to EC2

Terraform only prepares the server. After that, use **GitHub Actions** or manual SCP:

- **Automated:** see [GITHUB_DEPLOY.md](./GITHUB_DEPLOY.md) — push to `main` runs `.github/workflows/deploy-production.yml`
- **Manual:** copy code and run `scripts/deploy-app.sh` (below)

**Option A — SCP from your PC (no public Git required)**

```powershell
cd D:\dcb-backend
# Exclude node_modules — install on server
scp -i PATH\dcb-ap-key.pem -r `
  package.json package-lock.json tsconfig.json ecosystem.config.js prisma src `
  scripts/deploy-app.sh `
  ec2-user@EC2_PUBLIC_IP:/opt/dcb-backend/
```

SSH in:

```powershell
ssh -i PATH\dcb-ap-key.pem ec2-user@EC2_PUBLIC_IP
cd /opt/dcb-backend
chmod +x scripts/deploy-app.sh
./scripts/deploy-app.sh
```

**Option B — Git clone on first boot**

Set `app_repo_url` in `terraform.tfvars` before `terraform apply` (public repo or configure deploy key on the instance).

## Step 4 — Point the mobile app at production

In `dcb-frontend/.env`:

```env
EXPO_PUBLIC_API_URL=https://YOUR_CLOUDFRONT_DOMAIN
```

Use `terraform output api_url` (no `/api/v1` — the app adds that).

Rebuild or restart Expo. Test login on multiple devices on **Wi‑Fi or mobile data**.

## Step 5 — Verify

| Check | Command / action |
|--------|------------------|
| Health | `curl https://YOUR_CF_DOMAIN/health` → `{"status":"ok"}` |
| Login | App: `9000000001` / `Admin@123` (after seed) |
| S3 export | Chairman → Reports → export; check exports bucket |
| RDS | `terraform output -raw database_url` (sensitive) |

## Optional — Custom domain

1. Route 53 hosted zone for your domain.
2. In `terraform.tfvars`:
   ```hcl
   api_domain_name = "api.yourdomain.gov.in"
   route53_zone_id = "Z..."
   ```
3. `terraform apply` — validates ACM cert via DNS.
4. Set `EXPO_PUBLIC_API_URL=https://api.yourdomain.gov.in`

## Cost estimate (ap-south-2, rough)

| Service | ~USD/month |
|---------|------------|
| EC2 t3.small | $15 |
| RDS db.t3.micro | $15 |
| ElastiCache cache.t3.micro | $12 |
| ALB | $18 |
| CloudFront (low traffic) | $1–5 |
| **Total** | **~$60–70** |

Stop EC2/RDS when not testing to save money.

## Tear down

```powershell
terraform destroy
```

## Troubleshooting

- **502 from CloudFront** — SSH to EC2; `pm2 status`; `curl localhost:3000/health`.
- **DB connection errors** — security groups; `DATABASE_URL` in `/opt/dcb-backend/.env`.
- **Redis errors** — check `REDIS_URL` uses ElastiCache primary endpoint from `terraform output redis_primary_endpoint`.
- **CORS** — set `cors_origins` in tfvars or `.env` to include Expo origins; avoid `*` in real production.
