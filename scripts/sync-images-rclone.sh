#!/usr/bin/env bash
set -euo pipefail

: "${COS_BUCKET:?Set COS_BUCKET to the destination bucket name}"

if [[ -n "${RCLONE_CONFIG_COS_ENDPOINT:-}" ||
  -n "${RCLONE_CONFIG_COS_ACCESS_KEY_ID:-}" ||
  -n "${RCLONE_CONFIG_COS_SECRET_ACCESS_KEY:-}" ]]; then
  : "${RCLONE_CONFIG_COS_ENDPOINT:?Set RCLONE_CONFIG_COS_ENDPOINT}"
  : "${RCLONE_CONFIG_COS_ACCESS_KEY_ID:?Set RCLONE_CONFIG_COS_ACCESS_KEY_ID}"
  : "${RCLONE_CONFIG_COS_SECRET_ACCESS_KEY:?Set RCLONE_CONFIG_COS_SECRET_ACCESS_KEY}"
  export RCLONE_CONFIG_COS_TYPE="${RCLONE_CONFIG_COS_TYPE:-s3}"
  export RCLONE_CONFIG_COS_PROVIDER="${RCLONE_CONFIG_COS_PROVIDER:-Other}"
elif ! rclone listremotes | grep -qx 'cos:'; then
  echo "Configure a 'cos' remote with 'rclone config', or provide COS credentials via RCLONE_CONFIG_COS_*." >&2
  exit 1
fi

rclone sync ./docs/public/images/ "cos:${COS_BUCKET}/images/" \
  --progress \
  --checksum
