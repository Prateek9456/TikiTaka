#!/bin/sh
set -eu

export PORT="${PORT:-80}"
export BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-java-backend:8080}"
export NAMESERVER="${NAMESERVER:-$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)}"

envsubst '${PORT} ${NAMESERVER} ${BACKEND_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
