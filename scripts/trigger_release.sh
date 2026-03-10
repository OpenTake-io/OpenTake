#!/usr/bin/env bash
# Usage: ./scripts/trigger_release.sh <tag> "Release Title" "Release notes"
set -euo pipefail
if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required to trigger the workflow. Install: https://cli.github.com/"
  exit 1
fi
TAG="$1"
RELEASE_NAME="$2"
BODY="${3:-}" 
# Trigger the workflow_dispatch for the create-release workflow
gh workflow run .github/workflows/create-release.yml -f tag_name="$TAG" -f release_name="$RELEASE_NAME" -f body="$BODY"
echo "Triggered workflow to create release $TAG" 
