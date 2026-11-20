
set -euo pipefail

title="${RED_TITLE:-main is red}"
body="${RED_BODY:-${RED_WHAT:-ci} failed on main at ${GITHUB_SHA::7}. $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID}"
open=$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search "\"$title\" in:title" --json number --jq '.[0].number // empty')
if [ -n "$open" ]; then
  printf '%s' "$body" | gh issue comment "$open" --repo "$GITHUB_REPOSITORY" --body-file -
else
  printf '%s' "$body" | gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body-file -
fi
