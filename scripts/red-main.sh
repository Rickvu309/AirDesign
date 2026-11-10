set -euo pipefail

body="gate failed on main at ${GITHUB_SHA::7}. $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
open=$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search "\"main is red\" in:title" --json number --jq '.[0].number // empty')
if [ -n "$open" ]; then
  gh issue comment "$open" --repo "$GITHUB_REPOSITORY" --body "$body"
else
  gh issue create --repo "$GITHUB_REPOSITORY" --title "main is red" --body "$body"
fi
