#!/bin/bash
#
# deploy.sh - Convenience wrapper around deploy_templates.sh
#
# Bakes in the default production bucket, validates Wrangler auth up front,
# and fails fast with actionable instructions so you don't discover a missing
# token halfway through a deploy.
#
# Usage:
#   ./deploy.sh                 # deploy to production R2 (delegatebuild-templates)
#   ./deploy.sh --local         # deploy to local R2 simulation (no auth needed)
#   R2_BUCKET_NAME=other ./deploy.sh   # override the target bucket
#
set -euo pipefail

# Default production bucket (matches the GitHub Actions default).
R2_BUCKET_NAME="${R2_BUCKET_NAME:-delegatebuild-templates}"

# Parse --local flag.
LOCAL_R2="${LOCAL_R2:-false}"
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL_R2=true ;;
    *) echo "❌ Unknown argument: $arg"; exit 1 ;;
  esac
done

if [ "$LOCAL_R2" = "true" ]; then
  echo "🏠 Deploying to LOCAL R2 (bucket: $R2_BUCKET_NAME)"
else
  echo "☁️  Deploying to PRODUCTION R2 (bucket: $R2_BUCKET_NAME)"

  # Validate Wrangler auth before doing any work — a remote deploy is
  # pointless if the upload will fail at the end.
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    if ! npx wrangler whoami >/dev/null 2>&1; then
      echo "❌ Wrangler is not authenticated."
      echo "   Fix with one of:"
      echo "     npx wrangler login            # interactive browser login"
      echo "     export CLOUDFLARE_API_TOKEN=… # token-based auth"
      exit 1
    fi
  fi
  echo "✅ Wrangler authenticated"
fi

export R2_BUCKET_NAME LOCAL_R2
exec bash "$(dirname "$0")/deploy_templates.sh"
