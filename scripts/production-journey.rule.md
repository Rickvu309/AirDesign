# Production passes the journey after every deploy

`production-journey.yml` runs after each successful `deploy` run. It first waits up to 15 minutes for the API's `/version` to serve the deployed commit or a newer one (`scripts/production-commit.mjs`), and opens or comments on the `production journey failed` issue when it fails (`scripts/deploy.test.mjs`)
