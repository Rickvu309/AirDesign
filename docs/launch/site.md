# Prepare truthful discovery

Build the static site with `npm run verify:site`. Serve the generated `apps/site/dist` beside Studio only after an authorized deployment. Route `/studio` to Studio and preserve the `start` query parameter through sign-in. Landing offers a new deck and PowerPoint import. Pricing uses the shipped weekly allowance and weighted rates. No payment provider is activated.

The design references are [S11.01 and S12.01](../design/v0.1/README.md) and the [landing research](../design/v0.1/research/2026-11-04-landing-research.md). The candidate uses shared UI tokens, a restrained serif headline, one product capture, a centered pricing card, and direct agent instructions. Claims gated on external acceptance are omitted or described as pending.

The product image is a real capture from the built Studio on a synthetic saved deck. Reproduce it with `node bench/release/product-review.mjs --publish` before committing the site. The local adapter supplies deterministic title edits. The image makes no paid-model claim.

Generate the real package examples with `node bench/release/examples.mjs`. The provenance file records the source, SHA-256 hashes, edited part and unchanged package parts. Windows and Mac PowerPoint checks remain X01. Inspect package safety warnings before publishing any replacement fixture.

The Claude and Codex guides and the plain-text instructions are not yet verified with those clients. Their proposed HTTPS endpoint is inactive. Do not add supported badges until X05 supplies an authorized connection and revoke receipt for each client.

Run `node bench/release/site-review.mjs` for local Chrome captures, keyboard checks, reflow, measured contrast, and mobile LCP. The pinned network and CPU profile and raw trials are recorded with the receipt. The provisional LCP budget is 2.5 seconds. Report the research target of one second separately. Public network performance remains unmeasured before deployment.
