#!/usr/bin/env bash
set -eu
if [ "${1:-}" = --attempt ]; then
  : "${GH_TOKEN:?authenticated GitHub token required}"
  [ "$(uname -s)" = Linux ]
  case "$(uname -m)" in
    x86_64)
      asset=657617057
      digest=2e682fd2ddf8d6fdf9e46d9d99d99646ff0022a6abb0c2bca93011348a269fb9
      ;;
    aarch64)
      asset=657617441
      digest=d160ad2a029eaac4b4c85012adb67c1f5709ba81f7320edb5a27be928211d638
      ;;
    *) exit 1 ;;
  esac
  prefix="$HOME/tmp/release-tools"
  mkdir -p "$prefix"
  stage=$(mktemp -d "$prefix/railway.XXXXXX")
  trap 'rm -rf "$stage"' EXIT
  env -u GH_TOKEN -u GITHUB_TOKEN npm install --prefix "$prefix" --no-save wrangler@4.158.0
  env -u GH_TOKEN -u GITHUB_TOKEN npm install --prefix "$prefix" --no-save --ignore-scripts wrangler@4.158.0 @railway/cli@5.71.0
  gh api -H 'Accept: application/octet-stream' "repos/railwayapp/cli/releases/assets/$asset" > "$stage/asset.tar.gz"
  printf '%s  %s\n' "$digest" "$stage/asset.tar.gz" | sha256sum --check
  tar -xzf "$stage/asset.tar.gz" -C "$stage" railway
  [ "$("$stage/railway" --version)" = 'railway 5.71.0' ]
  install -m 755 "$stage/railway" "$prefix/node_modules/@railway/cli/bin/railway"
  version=$("$prefix/node_modules/.bin/railway" --version)
  [ "$version" = 'railway 5.71.0' ]
  printf '%s\n' "$version"
  exit 0
fi
for attempt in 1 2 3; do
  if timeout --kill-after=5s 120s bash "$0" --attempt; then
    exit 0
  else
    status=$?
  fi
  if [ "$attempt" -eq 3 ]; then
    exit "$status"
  fi
  sleep "$((attempt * 5))"
done
