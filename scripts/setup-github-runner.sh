#!/usr/bin/env bash
# One-time setup: register this EC2 instance as a GitHub Actions self-hosted runner.
# Run as ec2-user on the production server (SSH in first).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/tabrezkhan005/dcb-backend}"
RUNNER_VERSION="${RUNNER_VERSION:-2.321.0}"
RUNNER_DIR="${RUNNER_DIR:-/home/ec2-user/actions-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-dcb-production,linux,x64}"

if [ -z "${RUNNER_TOKEN:-}" ]; then
  echo "Get a registration token from:"
  echo "  GitHub → ${REPO_URL} → Settings → Actions → Runners → New self-hosted runner"
  echo ""
  echo "Then run:"
  echo "  RUNNER_TOKEN=YOUR_TOKEN bash $0"
  exit 1
fi

sudo yum install -y libicu rsync 2>/dev/null || sudo dnf install -y libicu rsync 2>/dev/null || true

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

if [ ! -f ./config.sh ]; then
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm -f actions-runner.tar.gz
fi

./config.sh \
  --url "${REPO_URL}" \
  --token "${RUNNER_TOKEN}" \
  --name "dcb-production-ec2" \
  --labels "${RUNNER_LABELS}" \
  --work _work \
  --unattended \
  --replace

sudo ./svc.sh install ec2-user
sudo ./svc.sh start

echo ""
echo "Runner installed. Verify in GitHub → Settings → Actions → Runners."
echo "Deploy workflow uses: runs-on: [self-hosted, dcb-production]"
