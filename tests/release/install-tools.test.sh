#!/usr/bin/env bash
set -eu
root=$(git rev-parse --show-toplevel)
work=$(mktemp -d "$HOME/tmp/install-tools-test.XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/fixture"
cat > "$work/fixture/railway" <<'SCRIPT'
#!/usr/bin/env bash
[ "$1" = --version ] || exit 1
if [ "$SCENARIO" = wrong-version ]; then
  printf 'railway 0.0.0\n'
else
  printf 'railway 5.71.0\n'
fi
SCRIPT
chmod +x "$work/fixture/railway"
tar -czf "$work/asset.tar.gz" -C "$work/fixture" railway
python3 - "$root/scripts/release/install-tools.sh" "$work" <<'SCRIPT'
import hashlib
import pathlib
import sys
source = pathlib.Path(sys.argv[1]).read_text()
work = pathlib.Path(sys.argv[2])
digest = hashlib.sha256((work / "asset.tar.gz").read_bytes()).hexdigest()
for pinned in ["2e682fd2ddf8d6fdf9e46d9d99d99646ff0022a6abb0c2bca93011348a269fb9", "d160ad2a029eaac4b4c85012adb67c1f5709ba81f7320edb5a27be928211d638"]:
    source = source.replace(pinned, digest)
(work / "install-tools.sh").write_text(source)
SCRIPT
cat > "$work/bin/npm" <<'SCRIPT'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$TEST_DIR/npm"
[ "$SCENARIO" != npm-fail ] || exit 17
case "$*" in
  *"@railway/cli@5.71.0"*)
    case "$*" in
      *--ignore-scripts*) ;;
      *) printf 'anonymous postinstall used\n' >&2; exit 88 ;;
    esac
    mkdir -p "$HOME/tmp/release-tools/node_modules/@railway/cli/bin" "$HOME/tmp/release-tools/node_modules/.bin"
    printf '#!/usr/bin/env bash\nexec "$(dirname "$0")/../@railway/cli/bin/railway" "$@"\n' > "$HOME/tmp/release-tools/node_modules/.bin/railway"
    chmod +x "$HOME/tmp/release-tools/node_modules/.bin/railway"
    ;;
  *"wrangler@4.158.0"*) ;;
  *) exit 90 ;;
esac
[ -z "${GH_TOKEN:-}" ] || exit 89
SCRIPT
cat > "$work/bin/gh" <<'SCRIPT'
#!/usr/bin/env bash
set -eu
[ "${GH_TOKEN:-}" = fixture-token ] || exit 91
[ "$*" = 'api -H Accept: application/octet-stream repos/railwayapp/cli/releases/assets/657617057' ] || exit 92
printf '%s\n' "$*" >> "$TEST_DIR/downloads"
case "$SCENARIO" in
  recover) [ "$(wc -l < "$TEST_DIR/downloads")" -ge 3 ] || exit 17 ;;
  fail) exit 17 ;;
  hang) exec /usr/bin/sleep 10 ;;
esac
cat "$TEST_DIR/asset.tar.gz"
if [ "$SCENARIO" = checksum ]; then printf corrupt; fi
SCRIPT
cat > "$work/bin/sleep" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$1" >> "$TEST_DIR/delays"
SCRIPT
cat > "$work/bin/timeout" <<'SCRIPT'
#!/usr/bin/env bash
[ "$1" = --kill-after=5s ] && [ "$2" = 120s ] || exit 1
shift 2
exec /usr/bin/timeout --kill-after=1s 2s "$@"
SCRIPT
cat > "$work/bin/uname" <<'SCRIPT'
#!/usr/bin/env bash
case "$1" in -s) printf 'Linux\n' ;; -m) printf 'x86_64\n' ;; *) exit 1 ;; esac
SCRIPT
chmod +x "$work/bin/"*
for scenario in success recover fail hang checksum wrong-version npm-fail unauthenticated; do
  rm -rf "$work/tmp/release-tools"
  : > "$work/npm"
  : > "$work/downloads"
  : > "$work/delays"
  token=fixture-token
  if [ "$scenario" = unauthenticated ]; then token=; fi
  status=0
  env PATH="$work/bin:$PATH" TEST_DIR="$work" HOME="$work" SCENARIO="$scenario" GH_TOKEN="$token" bash "$work/install-tools.sh" || status=$?
  downloads=$(wc -l < "$work/downloads")
  case "$scenario" in
    success|recover)
      [ "$status" -eq 0 ]
      [ -x "$work/tmp/release-tools/node_modules/@railway/cli/bin/railway" ]
      ;;
    *)
      [ "$status" -ne 0 ]
      [ ! -e "$work/tmp/release-tools/node_modules/@railway/cli/bin/railway" ]
      ;;
  esac
  case "$scenario" in
    success) [ "$downloads" -eq 1 ]; [ ! -s "$work/delays" ] ;;
    npm-fail|unauthenticated) [ "$downloads" -eq 0 ] ;;
    *) [ "$downloads" -eq 3 ] ;;
  esac
  if [ "$scenario" != success ]; then [ "$(printf '5\n10')" = "$(cat "$work/delays")" ]; fi
  case "$scenario" in fail|npm-fail) [ "$status" -eq 17 ] ;; hang) [ "$status" -eq 124 ] ;; esac
  if [ "$scenario" = unauthenticated ]; then [ ! -s "$work/npm" ]; fi
  if [ "$scenario" = success ]; then
    [ "$(head -n 1 "$work/npm")" = "install --prefix $work/tmp/release-tools --no-save wrangler@4.158.0" ]
    [ "$(tail -n 1 "$work/npm")" = "install --prefix $work/tmp/release-tools --no-save --ignore-scripts wrangler@4.158.0 @railway/cli@5.71.0" ]
  fi
  printf '%s: status=%s downloads=%s\n' "$scenario" "$status" "$downloads"
done
