#!/bin/sh
set -eu
case "${AIRDESIGN_ROLE:-web}" in
  web) entry=apps/server/src/main.ts ;;
  worker) entry=apps/worker/src/service.ts ;;
  *) echo "AIRDESIGN_ROLE must be web or worker" >&2; exit 1 ;;
esac
set -- node "$entry"
if [ "${AIRDESIGN_ROLE:-web}" = "worker" ] && [ "${AIRDESIGN_ISOLATION:-systemd}" = "container" ]; then
  set -- tini -s -- node apps/worker/src/container-worker-entry.ts "$entry"
fi
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data /home/node/tmp
  chown -R node:node /data /home/node/tmp
  exec setpriv --reuid=node --regid=node --init-groups --no-new-privs --bounding-set=-all --inh-caps=-all -- "$@"
fi
exec "$@"
