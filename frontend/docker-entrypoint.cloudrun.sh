#!/bin/sh
set -eu

export PORT="${PORT:-8080}"
export BACKEND_HOST="${BACKEND_HOST:?Set BACKEND_HOST to the API hostname, e.g. tikitaka-api-xxxxx-uc.a.run.app}"
# Strip protocol and trailing path/slash if a full URL was provided
BACKEND_HOST="$(echo "$BACKEND_HOST" | sed -e 's|^https\?://||' -e 's|/.*$||')"
export BACKEND_HOST

_ns="$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf 2>/dev/null || true)"
export NAMESERVER="${NAMESERVER:-${_ns:-8.8.8.8}}"

envsubst '${PORT} ${NAMESERVER} ${BACKEND_HOST}' \
  < /etc/nginx/templates/cloudrun.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
