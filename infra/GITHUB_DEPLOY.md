# Deploying DCB backend with Terraform + GitHub Actions

## Terraform vs GitHub Actions — you need both (different jobs)

| Tool | What it does | How often |
|------|----------------|-----------|
| **Terraform** | Creates AWS **infrastructure**: VPC, RDS, Redis, EC2, ALB, CloudFront, IAM | Once (or when infra changes) |
| **GitHub Actions** | Builds and **deploys application code** on the EC2 server | Every push to `main` |

This repo uses a **self-hosted GitHub Actions runner** on the production EC2 instance. That avoids opening SSH to GitHub’s hundreds of cloud runner IPs (AWS security groups cap rules at 60).

---

## One-time setup checklist

### 1. Register the EC2 self-hosted runner (one time)

SSH into the server:

```powershell
C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\Tabrez Khan\Downloads\dcb-ap-key.pem" ec2-user@98.130.44.76
```

On GitHub open:

**https://github.com/tabrezkhan005/dcb-backend** → **Settings** → **Actions** → **Runners** → **New self-hosted runner**

Copy the registration token, then on EC2:

```bash
cd /opt/dcb-backend
RUNNER_TOKEN=PASTE_TOKEN_HERE bash scripts/setup-github-runner.sh
```

Confirm the runner shows as **Idle** in GitHub (label: `dcb-production`).

### 2. Add optional GitHub secret

| Secret | Value | Required |
|--------|-------|----------|
| `PROD_API_URL` | `https://d6pvhtk154tym.cloudfront.net` | Optional (post-deploy health via CloudFront) |

No `PROD_EC2_SSH_KEY` is needed — deploy runs on the server itself.

### 3. Push the workflow to `main`

```powershell
cd D:\dcb-backend
git add .github/workflows/deploy-production.yml scripts/
git commit -m "Add GitHub Actions production deploy via self-hosted runner"
git push origin main
```

### 4. Verify

1. **Actions** tab → **Deploy Production** runs after push  
2. Or: **Actions** → **Deploy Production** → **Run workflow**  
3. `https://d6pvhtk154tym.cloudfront.net/health` → `{"status":"ok"}`

---

## What the workflow does

1. Checkout on the EC2 runner  
2. `rsync` into `/opt/dcb-backend/` (keeps existing `.env` on the server)  
3. `bash scripts/deploy-app.sh` → `npm ci`, build, migrate, seed, PM2 restart  
4. Health check (CloudFront if `PROD_API_URL` is set, else localhost)

**Triggers:** push to `main` when `src/`, `prisma/`, `scripts/`, or `package.json` change.

---

## Mobile app

```env
# dcb-frontend/.env
EXPO_PUBLIC_API_URL=https://d6pvhtk154tym.cloudfront.net
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Workflow queued, never starts | Runner offline — SSH in: `sudo /home/ec2-user/actions-runner/svc.sh status` |
| `No runners found` with label `dcb-production` | Re-run `setup-github-runner.sh` with a fresh token |
| Build fails on runner | SSH in, `cd /opt/dcb-backend && npm run build` for the error |
| DB errors | `.env` on EC2 must match RDS (written by Terraform user-data) |
| Runner token expired | GitHub → Runners → remove old runner → New self-hosted runner → new token |

---

## Security notes

- Do not commit `.env`, `terraform.tfvars`, or PEM files.  
- Keep `ssh_cidr_blocks` restricted to your IP for manual SSH.  
- The runner only needs outbound HTTPS to GitHub.
