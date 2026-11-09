#!/usr/bin/env bash
set -eu
root=$(git rev-parse --show-toplevel)
work=$(mktemp -d "$HOME/tmp/install-tools-test.XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"
cat > "$work/bin/npm" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$TEST_DIR/attempts"
case "$SCENARIO" in
  recover) [ "$(wc -l < "$TEST_DIR/attempts")" -ge 3 ] ;;
  fail) exit 1 ;;
  hang) exec /usr/bin/sleep 10 ;;
esac
SCRIPT
cat > "$work/bin/sleep" <<'SCRIPT'
#!/usr/bin/env bash
printf '%s\n' "$1" >> "$TEST_DIR/delays"
SCRIPT
cat > "$work/bin/timeout" <<'SCRIPT'
#!/usr/bin/env bash
[ "$1" = --kill-after=5s ] && [ "$2" = 120s ] || exit 1
shift 2
exec /usr/bin/timeout --kill-after=1s 0.2s "$@"
SCRIPT
cat > "$work/bin/rg" <<'SCRIPT'
#!/usr/bin/env bash
exit 127
SCRIPT
chmod +x "$work/bin/"*
export PATH="$work/bin:$PATH" TEST_DIR="$work" HOME="$work"
for scenario in recover fail hang; do
  export SCENARIO="$scenario"
  : > "$work/attempts"
  : > "$work/delays"
  status=0
  bash "$root/scripts/release/install-tools.sh" || status=$?
  if [ "$scenario" = recover ]; then [ "$status" -eq 0 ]; else [ "$status" -ne 0 ]; fi
  [ "$(wc -l < "$work/attempts")" -eq 3 ]
  [ "$(printf '5\n10')" = "$(cat "$work/delays")" ]
  [ "$(sort -u "$work/attempts")" = "install --prefix $HOME/tmp/release-tools --no-save wrangler@4.158.0 @railway/cli@5.71.0" ]
  printf '%s: status=%s attempts=3 delays=5,10\n' "$scenario" "$status"
done
grep -Fq 'run: bash scripts/release/install-tools.sh' "$root/.github/workflows/deploy.yml"
grep -Fq 'timeout-minutes: 7' "$root/.github/workflows/deploy.yml"
