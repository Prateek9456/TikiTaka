#!/bin/sh
set -eu

export PORT="${PORT:-8080}"
export BACKEND_HOST="${BACKEND_HOST:?Set BACKEND_HOST to the API hostname, e.g. tikitaka-api-xxxxx-uc.a.run.app}"
export NAMESERVER="${NAMESERVER:-$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)}"

envsubst '${PORT} ${NAMESERVER} ${BACKEND_HOST}' \
  < /etc/nginx/templates/cloudrun.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
