#!/bin/sh
set -eu

# A bind-mounted ./data may be created by the host as root. Fix ownership once,
# then drop privileges before starting the gateway.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown -R node:node /data
  exec su-exec node "$@"
fi

exec "$@"
