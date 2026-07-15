#!/usr/bin/env bash
# Install server-side Google Drive env vars on Vercel (Slack workflow persistence).
# Usage: ./scripts/install-vercel-drive-env.sh REFRESH_TOKEN [DATA_FOLDER_ID]

set -euo pipefail
cd "$(dirname "$0")/.."

REFRESH_TOKEN="${1:-}"
DATA_FOLDER_ID="${2:-}"

if [[ -z "$REFRESH_TOKEN" ]]; then
  echo "Usage: $0 REFRESH_TOKEN [DATA_FOLDER_ID]"
  echo "Get REFRESH_TOKEN from CIAB Settings → Server Drive (sign in with Google first)."
  exit 1
fi

for env in production preview development; do
  printf '%s' "$REFRESH_TOKEN" | npx vercel env add BOX_STUDIO_GOOGLE_REFRESH_TOKEN "$env" --force
  if [[ -n "$DATA_FOLDER_ID" ]]; then
    printf '%s' "$DATA_FOLDER_ID" | npx vercel env add BOX_STUDIO_DATA_FOLDER_ID "$env" --force
  fi
done

echo "Done. Redeploy: npx vercel --prod"
