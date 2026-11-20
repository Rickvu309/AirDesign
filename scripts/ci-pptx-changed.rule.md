# The corpus runs on a pull request that changes what it judges, so a break shows there and not first in the merge queue

One list of paths, `.github/actions/pptx-changed/paths.txt`, decides for the pptx part and for the corpus; a diff that cannot be read counts as changed. A pull request that touches none of them skips the corpus, and `ci` accepts that skip. The queue and main still run it every time (`scripts/ci-pptx-changed.test.mjs`, `scripts/ci-parts.test.mjs`)
