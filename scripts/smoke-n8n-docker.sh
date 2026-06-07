#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-n8n-nodes-package-auditor}"
PACKAGE_VERSION="${PACKAGE_VERSION:-}"
IMAGE_TAG="${IMAGE_TAG:-n8n-package-auditor-smoke:${PACKAGE_VERSION:-local}}"
IMAGE_TAG="${IMAGE_TAG//[^a-zA-Z0-9_.:-]/-}"
CONTAINER_NAME="${CONTAINER_NAME:-n8n-package-auditor-smoke-run}"
HOST_PORT="${HOST_PORT:-5684}"
WORKDIR="${WORKDIR:-/tmp/n8n-package-auditor-smoke}"

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

if [[ -n "$PACKAGE_VERSION" ]]; then
  INSTALL_TARGET="${PACKAGE_NAME}@${PACKAGE_VERSION}"
  COPY_TARBALL=""
else
  echo "Packing local package for n8n smoke install"
  TARBALL_PATH="$(npm pack --pack-destination "$WORKDIR" --silent)"
  TARBALL_FILE="$(basename "$TARBALL_PATH")"
  INSTALL_TARGET="/tmp/${TARBALL_FILE}"
  COPY_TARBALL="COPY ${TARBALL_FILE} /tmp/${TARBALL_FILE}"
fi

cat > "$WORKDIR/Dockerfile" <<DOCKER
FROM n8nio/n8n:latest
USER node
${COPY_TARBALL}
RUN mkdir -p /home/node/.n8n/nodes \
  && cd /home/node/.n8n/nodes \
  && npm init -y >/dev/null \
  && npm install ${INSTALL_TARGET} --omit=dev
DOCKER

echo "Building n8n smoke image: $IMAGE_TAG"
docker build -t "$IMAGE_TAG" "$WORKDIR"

echo "Verifying installed package module loads inside n8n image"
docker run --rm --entrypoint sh "$IMAGE_TAG" -lc '
  set -e
  node --version
  npm --version
  cd /home/node/.n8n/nodes
  npm ls n8n-nodes-package-auditor --depth=0
  test -f node_modules/n8n-nodes-package-auditor/dist/nodes/PackageAuditor/PackageAuditor.node.js
  node -e "const mod=require(\"./node_modules/n8n-nodes-package-auditor/dist/nodes/PackageAuditor/PackageAuditor.node.js\"); const node=new mod.PackageAuditor(); console.log(JSON.stringify({displayName: node.description.displayName, name: node.description.name, properties: node.description.properties.length}))"
'

echo "Starting n8n container: $CONTAINER_NAME"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "127.0.0.1:${HOST_PORT}:5678" \
  -e N8N_DIAGNOSTICS_ENABLED=false \
  -e N8N_VERSION_NOTIFICATIONS_ENABLED=false \
  -e N8N_SECURE_COOKIE=false \
  "$IMAGE_TAG" >/dev/null

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

python3 - <<PY
import sys, time, urllib.request
url = 'http://127.0.0.1:${HOST_PORT}/healthz'
for _ in range(60):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            print('health_status', response.status, response.read().decode('utf-8', 'ignore')[:200])
            sys.exit(0)
    except Exception:
        time.sleep(2)
print('health_check_failed')
sys.exit(1)
PY

echo "Exporting n8n node catalog and checking Package Auditor registration"
docker exec "$CONTAINER_NAME" n8n export:nodes --output=/tmp/nodes.json >/tmp/n8n-package-auditor-export.log
if ! docker exec "$CONTAINER_NAME" sh -lc 'grep -q "n8n Package Auditor" /tmp/nodes.json && grep -q "n8n-nodes-package-auditor.packageAuditor" /tmp/nodes.json'; then
  docker logs --tail 160 "$CONTAINER_NAME"
  echo "Package Auditor node was not found in exported n8n node catalog" >&2
  exit 1
fi

docker exec "$CONTAINER_NAME" sh -lc 'node - <<"NODE"
const fs = require("fs");
const nodes = JSON.parse(fs.readFileSync("/tmp/nodes.json", "utf8"));
for (const node of nodes) {
  const name = node.name || "";
  if (name.startsWith("n8n-nodes-package-auditor.packageAuditor")) {
    console.log(name);
  }
}
NODE'
echo "n8n Docker smoke test passed for ${PACKAGE_NAME}${PACKAGE_VERSION:+@${PACKAGE_VERSION}}"
