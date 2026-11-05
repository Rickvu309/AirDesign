set -eu
cd "$(dirname "$0")"
mkdir -p .cache/tmp
export TMPDIR="$PWD/.cache/tmp"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers"
export npm_config_cache="$PWD/.cache/npm"
npm ci --no-audit --no-fund
./node_modules/.bin/playwright install chromium
npm run probe
