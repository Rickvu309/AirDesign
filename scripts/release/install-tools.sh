#!/usr/bin/env bash
set -u
for attempt in 1 2 3; do
  if timeout --kill-after=5s 120s npm install --prefix "$HOME/tmp/release-tools" --no-save wrangler@4.158.0 @railway/cli@5.71.0; then
    exit 0
  else
    status=$?
  fi
  if [ "$attempt" -eq 3 ]; then
    exit "$status"
  fi
  sleep "$((attempt * 5))"
done
