#!/bin/sh
set -eu
case "${AIRDESIGN_ROLE:-web}" in
  web) entry=apps/server/src/main.ts ;;
  worker) entry=apps/worker/src/service.ts ;;
  *) echo "AIRDESIGN_ROLE must be web or worker" >&2; exit 1 ;;
esac
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data /home/node/tmp
  chown -R node:node /data /home/node/tmp
  exec setpriv --reuid=node --regid=node --init-groups --no-new-privs --bounding-set=-all --inh-caps=-all -- node "$entry"
fi
exec node "$entry"
