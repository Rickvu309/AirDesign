# Production passes the journey after every deploy

`production-journey.yml` runs after each successful `deploy` run. It reads the commit that deploy published, waits up to 15 minutes for the web app and the API to serve that commit or a newer one that contains it (`scripts/production-commit.mjs`), and opens or comments on the `production journey failed` issue when it fails (`scripts/deploy.test.mjs`)
