# Build AirDesign v0.1 through verified vertical slices

Turn main into an individual slide editor with live agent assistance and faithful PowerPoint exchange.
Delivery branch: `main`. Published into the repository on 2026-11-05 after the planning-only cleanup. Pin its accepted head before P01. P01 creates the workspace and UI; no root application, package scripts or reusable product kit exists yet.
This is an execution plan, not authorization to implement, spend, publish or merge.
Run P01 through P09 by dependency, with fidelity and edit-history decisions settled before dependent implementation.

## How to read this

One box is one unit of work. Every box names the evidence needed to check it. Check a box only when its evidence exists at the recorded head, fixture version and environment. Unchecked boxes describe future work. Proposed paths and commands below do not exist unless the baseline inventory says otherwise.

Execute exactly nine PRs in five phases. This is a hard delivery constraint. Internal checkpoints are development steps on the owning branch, with one owner, one final verification round, one PR review and one merge boundary per PR. Do not open separate checkpoint PRs or silently split a large PR. Escalate a scope change if a verified outcome cannot fit.

| Phase | PRs in order | Outcome |
|---|---|---|
| 1 | P01 | A signed-in workspace with accepted contracts and reusable UI |
| 2 | P02, P03 | Canonical rendering and safe editable PowerPoint import |
| 3 | P04, P05 | Durable manual editing, reconnect and saved-version exports |
| 4 | P06, P07, P08 | Templates and images, metered remote tools, Aira and account controls |
| 5 | P09 | Mandatory external acceptance and truthful discovery ready for publication |

| PR | One reviewable outcome | Ordered internal checkpoints |
|---|---|---|
| P01 | Signed-in workspace | W01 contracts, W02 UI/workspace, W08 access and server bootstrap |
| P02 | Deck and renderer | W03 canonical changes, W04 render and measure |
| P03 | Safe PowerPoint import | W05 authenticated isolated jobs, W06 preservation and native writing |
| P04 | Durable editing | W07 ordered history and undo, W09 optimistic sync and offline recovery |
| P05 | Manual Studio and export | W10 Home/editor/lifecycle, W11 saved-version export |
| P06 | Template and image workflow | W12 templates, W13 owned images |
| P07 | Metered MCP tools | W14 usage ledger, W15 OAuth consent and tool surface |
| P08 | Aira and account controls | W16 shared-tool agent, W17 credits/account/deletion |
| P09 | Accepted release and truthful site | W18 actual acceptance, W19 verified site/guides |

The stack is linear. Each PR targets its declared predecessor; P01 targets main. The critical editing path is visible by P05. Keep module interfaces small, but let closely related packages share one PR and end-to-end receipt. W01-W19 are ordered internal development checkpoints, not separate delivery or approval boundaries.


Use the ordered checkpoints and final PR gates below. On explicit go, owners may implement and prepare ready PRs. The operator lands them. No merge, production deployment or paid model/payment run is authorized by this plan. Product scope is desktop editing plus mobile reading, sign-in and viewing; no new mobile editor or Studio dark theme. Each PR with interaction changes has one operator review with screenshots and a short video in chat before merge. Use a local deterministic agent adapter until paid runs are explicitly authorized; adapter success never counts as the model-quality release gate.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

Read the [planning index](../README.md), [monorepo map](../content/monorepo-map.md), [design handoff](../../../design/v0.1/README.md) and research READMEs linked from the planning index. The [contract register](contract-index.json) lists every contract, the PR that freezes it, each PR's references and the real verification surface. Each PR accepts the contracts whose freezeIn names it in its first checkpoint before any consumer. Contracts frozen earlier are consumed as accepted. If evidence changes a contract, amend its decision and affected dependency boxes before coding consumers. P01-P08 merge on their named local evidence, with no unproved fidelity, assistive-technology, model, vendor or payment-provider claim. P03 produces the local engine and prepares the P03R external reference pack; P03R is an evidence batch, not another PR. P09 must close X01-X06 with actual evidence before accepting the release, then prove every published guide/example on that accepted build. No proxy closes an unavailable gate.

Build the UI from the v0.1 handoff using shadcn/ui CSS variables. Copy needed AI Elements patterns into `components/ai-elements/`; use Sonner and cmdk where needed. Keep one chat component system and free components only. Define the two project motion tokens once.

## Program checklist

### Arm the program

- [ ] Record explicit execution go and confirm the target repository from `git remote -v`. Save `~/tmp/airdesign-autopilot/program/authorization.md`. Record the accepted post-cleanup stack-root SHA before implementation.
- [ ] Use `main` as the implementation stack root and ordinary P01 target. Pin the accepted post-cleanup head and inspect its actual files. Record the current default branch head, parent heads and merge bases in `program/bases.json`; do not infer current files from the historical research SHA. For every lane, trunk means the recorded stack root or explicit predecessor.
- [ ] Adopt an event-driven supervisor. The literal `/loop 1h` from the source playbook is unavailable here and must not become a polling loop. Use delegate completion events and native PR watches. Send a status message only for changed facts or a concrete blocker. Save the selected runtime and notification behavior in `program/runtime.md`.
- [ ] Adopt all 24 decisions and the per-PR maps from `contract-index.json` into `program/contract-index.json`. Freeze the P01 choices. Unresolved P01 contracts block P01. Deferred contracts are listed with an owner and freeze PR. Inventory unavailable external evidence now, but require its actual acceptance only at P09 X01-X06 and P09's published claims. Save an explicit owner and required evidence for every external gate.
- [ ] On hold, stop new writes and cancel active owners using their task ids. Save the last accepted head and pending work in `program/handoff.md`. On restart reconstruct from that file and task receipts, never launch duplicate writers.

### Spawn owners

- [ ] Implementation owners, reviewers and live-verification lanes use the models the operator assigns at execution. The current assignment is Grok implements and Codex reviews. Resolve each model from the operator's model settings and record it per task in `program/tasks.json`. Rediscover exact provider capabilities before execution. Every brief includes the model, tool-call budget, owned paths, acceptance command, evidence path and report limit. Save dispatch receipts in `program/tasks.json`.
- [ ] Follow the linear P01-P09 dependency stack. One PR owner writes at a time. Each owner starts from its recorded predecessor head and completes the ordered internal checkpoints. Do not consume an uncommitted shared directory. Save base and head SHAs in each PR receipt.
- [ ] Give the active owner an isolated checkout and database namespace. Read-only review lanes use isolated fixture contexts. One owner writes shared workspace configuration. Use the orchestration tool for checkout isolation. Save ownership in `program/owners.json`.
- [ ] Keep exactly nine PRs, each with its stated outcome. Use verified commits and internal checkpoints to control review size. If an outcome needs scope reduction, record the proposal and get the operator decision before changing scope. Do not create child PRs, helper PRs or an additional delivery boundary beyond P01-P09.
- [ ] Review-gate all nine PRs once at their final heads. P03 reviews local preservation receipts and the unproved reference inventory; P04 reviews browser recovery and undo plus authenticated command captures. Actual PowerPoint and screen-reader evidence gate P09. UI gates review real screenshots and a short video. Use terminal captures for command surfaces; never invent a UI to satisfy a gate.

### PR mechanics

- [ ] Resolve the forge once. Prefer the available repository CLI and record it. Open ready PRs after explicit execution go. A stack child targets its declared parent; otherwise target `main`. For multiple prerequisites use the merged stack-root heads or a recorded integration parent; never silently stack on an undeclared feature. Link every created or pushed PR using the host linking tool. Save its URL and head.
- [ ] Preserve global git authorship `rickvu <minhquanvu3902@gmail.com>`. Do not override identity, add AI attribution or bypass hooks. Run the repository checks through pstack-run and retain full logs under `~/tmp`.
- [ ] Inspect the exact diff, remove dead scaffolding, and run deslop before commit. Run independent code review once at the final PR head; rerun the affected checks after accepted fixes. Save objections, accepted fixes and rerun evidence rather than relying on the PR description.
- [ ] Keep contract changes, fixtures and migrations in the PR that needs them. Introduce only packages consumed by that slice. Do not build Share or Present. Replace simulated drafting with real activity.
- [ ] Before code-ready, update to the appropriate trunk or parent once and record the merge base. Recheck changed behavior after fixes. Never silently reuse evidence from a different head. Save patch and evidence fingerprints.
- [ ] Any tool schema or description change after the P09 evaluation baseline reruns the at-least-40-task, three-trial, Claude-plus-second-model evaluation. Before that baseline, P07-P08 handoffs name the pending P09 X03 gate; local reference-client success is not the model behavior pass. If authorized model access is missing, record blocked evidence and do not ship the changed capability.

### Verdict and merge

- [ ] Run one complete verification round at code-ready. Ten live lanes are scenarios, not ten required simultaneous machines. Run bounded concurrent isolated lanes and retain every receipt. Add independent architecture and security reviews when their boundaries change.
- [ ] Classify findings as new regression, existing trunk defect, missing evidence or product decision. New regressions and missing required evidence block the affected PR. Existing trunk defects stay visible and cannot justify a new defect. Save `verdict.md`.
- [ ] Stop each PR at merge-ready for the operator. Never infer merge approval from plan approval. If explicitly asked to wait on CI or reviews, finish the push, call the native PR watch and end the turn without polling.
- [ ] After an authorized operator merge, remove the task worktree, local branch, temporary database and throwaway folders. Retain review artifacts in the program archive and list cleanup in `handoff.md`. Start the next shipped scope in a new thread only when the operator requests that thread.

### Boot recipe

- [ ] P01 introduces `scripts/verify-baseline.mjs` and an evidence manifest. Each PR adds one aggregate verify:pr-XX command that runs its checkpoint verify:* commands and a reproducible seed. Checkpoints do not require separate full review rounds. There is no root package yet. P01 introduces it. Save installed tool versions and lockfile hashes.
- [ ] Start the minimum services the PR actually needs. Introduce Postgres, object-store substitute, worker and email/payment fakes with their first consumers, using unique ports and fixture accounts. Wait on a ready signal from the launched job, not a polling loop. Save startup logs and seed identifiers.
- [ ] Use the public verification surface named in each PR and the contract register. P02 introduces a packed-consumer `probe:deck` CLI and a real render fixture. W08 in P01 creates the server bootstrap and authenticated principal boundary. W05 in P03 adds job routes using that real principal, without a fixture authentication bypass. P01 uses a signed opaque return fixture, P05 persists a pending request and W14 in P07 uses trusted ledger credit grants. W15 in P07 proves real consent, W16 in P08 proves Aira and W17 in P08 proves provider integration. Use actual supported browser controls when authorized; no `control-ui` or `control-cli` skill is installed here.
- [ ] Capture UI screenshots from the real browser. For a CLI/API lane save its structured response and a terminal capture, without fabricating a UI. Keep all artifacts under `~/tmp/airdesign-autopilot/Pxx/lane-N/`. A lane that drives several checkpoints records a separate verdict and evidence per checkpoint; the lane fails if any fails, and the receipt names which. Resolve `~` to the actual home in recorded paths.
- [ ] Pin head SHA, fixture, viewport, font hashes and rendering environment in `manifest.json`. Mask credentials. Read-only DB or deck diagnostics may support the result; they cannot replace driving the public surface.
- [ ] For each perf probe record workload, sample count, warm/cold state and limiter. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Keep the relative rule for comparable operations: measure comparable trunk first, then interleave trunk and head. If trunk lacks the feature, record missing and measure the added operation against its absolute budget; do not apply relative p95 rules to unlike work or noise. Documentation-only follow-ups may record perf N/A with a reason and proof of no runtime diff. P01 includes CLI/access/UI runtime and P09 includes a built site, so neither whole PR is automatically N/A. P01 must adopt or explicitly revise every budget in C07, including a separate PDF deadline.


## Ship a signed-in workspace (P01)

**Depends on.** None.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P01/files.txt`: `bench/`, `fixtures/pptx/`, `docs/contracts/`, `scripts/verify-baseline.mjs`, `program/contract-index.json`, `package.json`, `packages/ui/`, `apps/studio/`, `packages/access/src/`, `apps/server/src/main.ts`, `apps/studio/src/access/`

**Contract references.** C01, C02, C03, C04, C06, C07, C08, C09, C16, C19, C21, C22 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W01 probe:compat fixture CLI and contract-index validator; W02 packed UI consumer and real component fixtures; W08 real browser access and protected account/session API.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P01/build.md`.

- [ ] W01. Freeze contracts and bound feasibility evidence. Create a versioned decision bundle, compatibility matrix, licensed-fixture inventory and contract schemas. Adopt every entry and per-PR reference in the study contract-index.json into program/contract-index.json. Replace each P01 decision with an accepted rule, alternatives, source, owner, examples and evidence. Unresolved P01 contracts block P01. Deferred contracts are listed with an owner and freeze PR. The contracts accepted in this checkpoint are person protection and run epochs, structural run undo and adoption, individual undo/redo and undo_change, native kept flagged and source preservation, the principal and ownership boundary, performance budgets, rendering and font tolerance, email access and session policy, retention and deletion, worker resource and security limits, evidence and external gate boundaries, and tokens, accessibility and phone scope. Introduce a stand-alone fixture CLI via npm run probe:compat with fixture and output arguments, reusing the narrow text-span preservation probe. Inventory Windows/Mac PowerPoint builds, licensed fonts and assistive-technology drivers. Unavailable external evidence is inventoried here and required by P09, not an unchecked merge requirement on foundation PRs. No production fidelity claim follows from this feasibility CLI. Verify its behavioral command `npm run verify:contracts` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P01/checkpoints/W01/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W02. Build the v0.1 UI workspace. Build the shared UI package and Studio shell from the v0.1 component, token and copy contracts. Use shadcn/ui CSS variables as canonical tokens and copy needed AI Elements patterns into components/ai-elements/. Use Sonner for toasts and cmdk for commands. Introduce workspace scripts, package exports and import-boundary checks. Apply the documented Geist, blue and paper palette with contrast corrections and the shared motion tokens. Keep Studio light-only; do not import design generators or research prototypes into product bundles. Diff the two copy kits and freeze one canonical keyed source. Verify its behavioral command `npm run verify:ui` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P01/checkpoints/W02/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W08. Authenticate people and isolate their data. Implement email link and code sign-in using Better Auth behind the access module. Preserve pending deck and agent intent. Enforce ownership on every resource boundary, session revocation and non-enumerating responses. Keep mail delivery behind an injected adapter with a local inbox in development. Create the minimal server bootstrap and authenticated principal boundary here. Expose only the account/session and signed-intent surfaces that exist. P03 adds protected job routes using this principal; P04 adds deck isolation when those resources exist. Carry a signed opaque return intent through access without implementing agent consent yet; real approval integration belongs to P07. Support phone sign-in and link/code recovery at 320 CSS px. Local merge evidence covers keyboard, autofill, focus, error text and the accessibility tree. Actual screen-reader transcripts for this flow are the P09 X02 release gate, not a required P01 merge artifact. Verify its behavioral command `npm run verify:access` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P01/checkpoints/W08/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] A person signs in on desktop or phone, reaches a real workspace shell and returns to the same validated intent. The UI consumer works from its packed artifact and every shared contract is accepted. Save the actual outcome in `~/tmp/airdesign-autopilot/P01/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-01` to run the owned commands in order, namely npm run verify:contracts then npm run verify:ui then npm run verify:access. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P01/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W01 contract fixtures against the v0.1 authority; then W02 a freshly packed clean React 19 consumer; then W08 sign in with a local inbox at trunk and head. Save `~/tmp/airdesign-autopilot/P01/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W01 authority and complete contract-index audit; then W02 package exports; then W08 single-use link through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires every contract whose freezeIn is P01 resolves through the per-PR contract map to an accepted entry with pinned source SHA, decision and counterexamples; proposed defaults are explicitly accepted or replaced; deferred contracts are listed with an owner and freeze PR; and W02 requires all documented exports import from the installed tarball; and W08 requires one successful link consumption invalidates every replay. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W01 old versus new run epoch contract; then W02 strict consumer typecheck; then W08 15-minute expiry through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires the contract examples protect a person edit from an older run and permit a new explicit request under the frozen rule; and W02 requires a clean consumer compiles with skipLibCheck false; and W08 requires a link beyond the 15-minute lifetime refuses access and retains intent. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W01 adopted child undo contract; then W02 light theme; then W08 wrong code through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires the adopted-child counterexample specifies surviving ids and parents without losing the person contribution; and W02 requires all semantic surfaces and focus states render with legible light tokens; and W08 requires a wrong code never creates a session and can be retried within rate policy. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W01 native kept flagged matrix; then W02 light-only Studio states; then W08 30-second resend through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires every fixture feature has a support classification and an honest proven or unproven status; and W02 requires all documented Studio states remain legible in the specified light theme; no Studio dark-mode feature is introduced; and W08 requires resend becomes available only after 30 seconds and invalidation behavior matches the frozen contract. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W01 font and license inventory; then W02 keyboard tabs; then W08 alternate email through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires each font has a hash and license state or an explicit unresolved entry; and W02 requires one tab stop enters each toolbar and arrows select the intended control; and W08 requires changing email returns to a clear entry state without exposing another account. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W01 hostile file and font expectations; then W02 dialog focus; then W08 signed opaque return intent through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires fixture expectations declare ZIP/XML, network-egress, CPU, memory, time and isolated-temp limits plus a hostile-font case for P03; and W02 requires focus enters the dialog, Escape closes it and focus returns to the trigger; and W08 requires authentication returns the same validated signed opaque fixture intent without open redirect; real MCP approval/restart is verified in P07. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W01 Windows and assistive-technology availability; then W02 reduced motion; then W08 session revoked through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires the receipt inventories Windows and actual screen-reader drivers and marks missing P09 X01 or X02 evidence blocked without claiming a pass; and W02 requires the media preference removes nonessential movement while preserving feedback; and W08 requires revoked sessions fail subsequent protected calls and return to sign-in safely. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W01 Mac reference availability; then W02 canonical semantic tokens; then W08 cross-owner request through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires the receipt inventories a pinned Mac reference or marks P09 X01 blocked without claiming a reopen pass; and W02 requires every app color resolves through the documented shadcn semantic tokens; and W08 requires cross-owner protected account requests reveal no protected data and perform no write; protected job retrieval is checked when P03 introduces jobs, and deck isolation is checked in P04. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W01 versioned provenance schema; then W02 design-tooling import isolation; then W08 keyboard, accessibility tree and phone access through the public surface. Save `~/tmp/airdesign-autopilot/P01/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W01 requires the contract schema validates stable ids and source provenance with a versioned migration policy; and W02 requires the production entry and bundle do not import design generators or research prototypes; and W08 requires code/link flow, full-code paste, autofill, visible focus and named errors work with keyboard at desktop and 320 CSS px; accessibility-tree records contain the correct names and status roles. P09 X02 owns actual screen-reader transcripts and announcement behavior. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W01 fixture-run wall time and peak RSS; W02 consumer import size and shell startup time; W08 local authentication response latency. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P01/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P01/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P01/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W01 the local fixture CLI terminates within 30 s on its declared small corpus; unavailable external references are inventories only and remain blocked at P09; W02 freeze initial packed-JS and startup budgets in W01, measure the clean v0.1 consumer against them, and record absence of a comparable trunk implementation; W08 provisional warm p95 at most 500 ms excluding external mail delivery; record inbox delivery separately. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P01/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P01/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P01/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Build the canonical deck and renderer (P02)

**Depends on.** P01.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P02/files.txt`: `packages/deck/src/`, `packages/deck/test/`, `scripts/probe-deck.mjs`, `packages/render/src/`, `bench/render/`, `packages/lint/src/`

**Contract references.** C01, C02, C03, C04, C07, C08, C22 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W03 packed-consumer probe:deck CLI; W04 Studio render fixture and server snapshot CLI.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P02/build.md`.

- [ ] W03. Implement the canonical deck and atomic changes. Define Deck, Slide, Element and ChangeSet with stable short ids and explicit original-source references. Implement dependency-free apply returning deck and inverse or a typed error. Support insert, set, move and remove, arbitrary slide sizes, group structure, theme references, notes, placeholders and native/kept/flagged variants. Keep JSX in a separate adapter-loaded entry. Introduce a packed-consumer probe:deck command that accepts fixture ChangeSets and emits the observed deck, inverse or typed error; it is the public verification surface for this library-only slice. Verify its behavioral command `npm run verify:deck` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P02/checkpoints/W03/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W04. Render and measure one deck consistently. Expose Slide, render/server.snapshot and render/measure.measure. Start with React DOM and SVG shape geometry. Preserve native text editing, IME and accessible text. Wait for pinned fonts, collect layout reads in one pass, cache thumbnails by slide version and patch only touched elements. Implement hard defect checks separately from preference judging. Verify its behavioral command `npm run verify:render` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P02/checkpoints/W04/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] A packed consumer creates and atomically changes a canonical deck, then the Studio fixture and server snapshot render the same saved deck with pinned fonts. Save the actual outcome in `~/tmp/airdesign-autopilot/P02/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-02` to run the owned commands in order, namely npm run verify:deck then npm run verify:render. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P02/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W03 serialize and reopen a fixture deck; then W04 render a reference slide at trunk and head. Save `~/tmp/airdesign-autopilot/P02/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W03 insert slide; then W04 300-element drag through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires one new slide has a stable unique id and is inserted at the requested position; and W04 requires drag commits the intended position without losing selection or exceeding the frame budget. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W03 insert group; then W04 zoom and pan through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires children retain stable ids and the group owns exactly the requested children; and W04 requires pan and zoom preserve pointer-to-slide coordinates and keyboard focus. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W03 move parent; then W04 100-slide open through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires the requested element has one parent and document order is correct; and W04 requires the first slide becomes editable before the frozen startup deadline. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W03 remove subtree; then W04 IME composition through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires the subtree is removed atomically and unrelated ids and content remain; and W04 requires composing text does not commit partial characters or lose the composition on render. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W03 set text; then W04 font fallback through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires Unicode text and style runs change only at the requested target; and W04 requires the fallback is disclosed and measurement waits for the selected loaded font. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W03 invalid cycle; then W04 SVG geometry through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires a cycle returns a typed error and the entire deck remains unchanged; and W04 requires the SVG edges and hit areas agree at the tested zoom levels. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W03 invalid reference; then W04 clipping report through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires a dangling reference is rejected without partial mutation; and W04 requires a true clipped item is reported with its id and actionable location. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W03 unicode text; then W04 intentional overlap through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires mixed scripts and combining characters survive serialize and inverse; and W04 requires an approved intentional overlap is not marked as an accidental collision. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W03 inverse round trip; then W04 snapshot parity through the public surface. Save `~/tmp/airdesign-autopilot/P02/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W03 requires applying a valid change then its inverse restores semantic equality without mutating the input; and W04 requires the Studio fixture and server snapshot match within the frozen rendering tolerance using identical fonts; worker integration is deferred to P05. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W03 apply latency and touched-object allocation on 300-element deck; W04 frame time, edit-to-paint and first-editable time. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P02/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P02/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P02/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W03 set a provisional p95 apply budget of 4 ms; record absolute result when trunk lacks apply; W04 60 fps target at 300 elements; edit drawn within 16 ms; first slide editable within 2 s for 100 slides on the pinned reference machine. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P02/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P02/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P02/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Import and preserve PowerPoint safely (P03)

**Depends on.** P02.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P03/files.txt`: `apps/worker/src/`, `packages/files/src/`, `packages/operations/src/`, `apps/server/src/operations/`, `packages/pptx/src/`, `packages/pptx/test/`, `fixtures/pptx/`

**Contract references.** C04, C06, C07, C08, C16, C19, C21 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W05 authenticated job CLI against server and worker; W06 PPTX CLI, local reimport and LibreOffice fast check.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P03/build.md`.

- [ ] W05. Run durable isolated file operations. Implement queued operations with durable ids, ownership, bounded retries, cancellation, input limits and artifact expiry. Keep Chromium and parsing outside the API process. Reject external file paths and private-network URLs, revalidate redirects, sanitize SVG, and make repeated job delivery converge to one result. Use the authenticated P01 principal for job submission, polling, cancellation and artifact retrieval. Add the operation adapter to the existing server bootstrap and reject cross-owner jobs on every path. Do not introduce a fixture authentication bypass. Deny renderer network egress, resolving authorized images and fonts into bounded local inputs before render. Enforce per-job CPU, memory and wall-clock limits in a killable process/container. Give each owner/job an isolated temporary directory and reclaim it on cancel, timeout or crash recovery. Parse embedded/uploaded fonts in the same isolation and reject hostile fonts. A killed job must not affect the next owner job. Verify its behavioral command `npm run verify:operations` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P03/checkpoints/W05/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W06. Preserve and selectively edit PowerPoint packages. Implement the local preservation engine. Retain original OPC payloads and relationship graphs, capability classifications, narrow native editors, copy-on-write dependencies, font provenance and explicit security exceptions. Export untouched imported parts exactly and generate native text, shapes, tables and charts through qualified selective writers. Validate local parse/reimport, part hashes, relationship closure, safety reports and LibreOffice fast checks; LibreOffice is only a fast check, never PowerPoint fidelity proof. Carry unverified application metadata and visual/editability support as unproven. Produce the P03R reference-evidence pack for P09 X01, covering pinned Windows and Mac applications, licensed fonts, no-repair reopening, native editing and frozen visual/line-count thresholds. P03R is an external evidence batch, not an additional implementation PR. Missing references block P09 release acceptance, while P03 can merge on its local engine evidence without a fidelity support claim. Verify its behavioral command `npm run verify:pptx` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P03/checkpoints/W06/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] An authenticated person submits a PowerPoint job, survives interruption and receives a locally validated editable/preserved result with honest capability labels. Real PowerPoint evidence remains P09 X01. Save the actual outcome in `~/tmp/airdesign-autopilot/P03/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-03` to run the owned commands in order, namely npm run verify:operations then npm run verify:pptx. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P03/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W05 submit and recover a fixture operation; then W06 unchanged imported presentation at trunk and head. Save `~/tmp/airdesign-autopilot/P03/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W05 duplicate delivery; then W06 text-run patch through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires one immutable receipt and one output result exist for duplicate delivery; and W06 requires styled text edits preserve every untouched part and unrelated run. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W05 worker crash; then W06 imported and natively created tables/charts through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires restart resumes or safely retries the same operation without duplicate artifacts; and W06 requires imported objects preserve declared native/kept semantics and a newly created text/table/chart deck passes local serialization and LibreOffice fast checks; actual Windows/Mac editability is reserved to P09 X01. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W05 cancel; then W06 groups and themes through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires cancel stops future writes and leaves a terminal readable operation status; and W06 requires groups, masters and theme references retain their relationships and visible placement. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W05 result expiry; then W06 master placeholders through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires an expired result is unavailable with an explicit recovery action; and W06 requires placeholder inheritance and relationship closure survive local reimport and fast rendering; real PowerPoint captures are mandatory in P09 X01. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W05 wrong owner; then W06 speaker notes through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires another owner cannot read status or retrieve the artifact; and W06 requires speaker notes survive and remain associated with the correct slide. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W05 ZIP expansion; then W06 kept object move through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires expansion limits terminate the job without leaving extracted payloads; and W06 requires moving a preserved object changes only declared placement dependencies. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W05 DTD input; then W06 unknown XML through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires entity expansion and external XML resolution are disabled; and W06 requires unknown elements and namespace content retain their original payload bytes. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W05 redirect SSRF; then W06 unsafe content removal through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires redirect chains cannot reach loopback, metadata or private-network destinations; and W06 requires security removals are listed explicitly and unsafe relationships are absent. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W05 renderer egress, hostile font, OOM and temp cleanup; then W06 metadata local round trip and reference pack through the public surface. Save `~/tmp/airdesign-autopilot/P03/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W05 requires rendered content cannot fetch metadata/private/public URLs; hostile fonts are refused safely; an enforced OOM/CPU kill ends the job terminally, removes its isolated temporary payload and permits the next owner job; and W06 requires stable identifiers and provenance survive local reimport without duplicate elements; source hashes and missing-font/kept/flagged reports are complete, and every unproved Windows/Mac claim is explicitly queued in P03R for P09 X01. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W05 acknowledgment latency and worker RSS; W06 import/export time and visual difference. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P03/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P03/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P03/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W05 operation id within 1 s; PPTX input at most 100 MB, expanded 500 MB, 10000 parts and 30 s; tune other job limits from fixtures; W06 local worker limit is 30 s; hash and graph invariants must pass. P09 X01 additionally requires at most 0.1 percent changed pixels per slide and 1 percent per item with unchanged text line counts on matched pinned references, as adopted or explicitly revised with evidence in P01. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P03/perf/verdict.json`.

**Review gate.**

- [ ] Show a real terminal screenshot and short terminal video of local CLI/LibreOffice receipts, source-part hashes, relationship/security reports and the P03R unproved-reference inventory. Make no real-PowerPoint support claim. Save the operator decision in `~/tmp/airdesign-autopilot/P03/operator-review.md` and wait before merge. Actual application captures and native editing are mandatory P09 X01 evidence.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P03/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Make editing durable across clients and reconnects (P04)

**Depends on.** P03.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P04/files.txt`: `packages/change-log/src/`, `apps/server/src/db/`, `packages/change-log/test/`, `apps/server/src/commands/`, `packages/rpc/src/`, `apps/server/src/rpc/`, `apps/studio/src/sync/`

**Contract references.** C01, C02, C03, C06, C07, C11, C18 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W07 two authenticated command clients with separate database connections; W09 two browser sync clients and command/WebSocket API.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P04/build.md`.

- [ ] W07. Persist ordered edits and selective run undo. Commit commands, receipts, events and projections in one Postgres transaction per deck. Version scalar properties and structure. Derive actor identity from trusted access context. Protect person edits against older runs while permitting a later explicit request under the P01 contract. Replay history for undo, preserve later person edits and forbid id reuse with changed payloads. Test structural interleavings and restart recovery, beyond the scalar prototype. Use the shared P01 principal type through P01 access; keep persistence wiring in the server adapter instead of inventing a new shared db package. The slice is driven through its authenticated command API with two database connections, before Studio or a model exists. Expose the authenticated command API in apps/server/src/commands/ for the two-client probes, including individual undo/redo and undo_change counterexamples from the accepted contract index. Verify its behavioral command `npm run verify:change-log` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P04/checkpoints/W07/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W09. Deliver optimistic edits with durable offline recovery. Wire typed RPC and ordered WebSocket replay to change-log. Persist queued commands in IndexedDB before network transmission; distinguish local pending from server-saved state. Rebase reconnecting clients, separate selection and gesture presence from deck mutations, and retain rejected edits targeting deleted structure for explicit restore. Expose saved, offline and retrying states honestly. Queued person commands win over intervening older agent values after reconnect in server arrival order; stale-agent refusal must never be reused for person edits. Ask and Export wait offline with honest copy. Key outbox storage by principal and clear or isolate it on sign-out/account switch without applying one account edits under another. Verify its behavioral command `npm run verify:sync` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P04/checkpoints/W09/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] Two signed-in clients converge on ordered edits, recover after offline work and undo an agent run while preserving later person changes. Save the actual outcome in `~/tmp/airdesign-autopilot/P04/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-04` to run the owned commands in order, namely npm run verify:change-log then npm run verify:sync. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P04/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W07 two actors edit one deck; then W09 edit disconnect reload reconnect at trunk and head. Save `~/tmp/airdesign-autopilot/P04/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W07 same property race; then W09 two tabs and offline person-versus-agent conflict through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires an older agent run cannot overwrite a protected human value and a new explicit run follows the frozen epoch rule; and W09 requires both tabs converge in server order; a queued offline person edit lands over the intervening agent value and becomes protected from that older run. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W07 independent property; then W09 lost acknowledgment through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires independent properties both commit in one server order; and W09 requires the outbox retry gets the same commit id and no duplicate operation. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W07 insert then human edit; then W09 queue reload through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires undoing the inserting run applies the frozen adoption policy and preserves the later human contribution; and W09 requires reload retains queued commands and their stable request ids. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W07 move then undo; then W09 server restart through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires undo restores only run-owned structure and retains later person placement; and W09 requires reconnect replays only missing commits and a fresh snapshot matches the server. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W07 remove versus late command; then W09 stale agent base through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires a command to deleted structure is refused atomically with recoverable request details; browser restoration is deferred to P04; and W09 requires a stale agent command refuses the whole batch with recovery metadata. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W07 lost ACK; then W09 deleted slide through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires retry returns the original immutable receipt without another committed command or version; usage debits are deferred to P07; and W09 requires the removed slide edit remains recoverable through a clear restore choice. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W07 payload mismatch; then W09 deleted deck through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires the reused request id with changed payload is rejected atomically; and W09 requires the client stops writes and presents an explicit deleted-deck recovery state. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W07 database restart; then W09 retry after 3 seconds and offline actions through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires durable receipt and replayed document agree after process restart; and W09 requires bounded retries preserve edits and show the promised message after 3 seconds; offline Ask and Export are disabled with honest recovery copy. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W07 closed run late write; then W09 expired session, sign-out and account switch through the public surface. Save `~/tmp/airdesign-autopilot/P04/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W07 requires a closed run cannot append a late tool result or resurrect itself; and W09 requires re-authentication retains the same principal pending edits, while sign-out/account switch clears or isolates the principal-keyed queue and cannot transmit it as another person. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W07 commit latency and bounded history replay; W09 commit-to-paint trace and reconnect time. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P04/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P04/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P04/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W07 provisional warm p95 commit at most 50 ms on the pinned local stack, leaving room for the 100 ms commit-to-paint budget; reject unbounded replay growth; W09 connected commit-to-paint p95 at most 100 ms; propose 2 s recovery for a 100-command local queue and measure before raising it. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P04/perf/verdict.json`.

**Review gate.**

- [ ] Show before/after browser screenshots and a short video of two authenticated clients recovering and undoing, including adopted-child undo and old versus new run epochs. Include structured command receipts and real terminal captures for the database boundary. Save the operator decision in `~/tmp/airdesign-autopilot/P04/operator-review.md` and wait before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P04/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Deliver the manual Studio and exports (P05)

**Depends on.** P04.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P05/files.txt`: `apps/studio/src/decks/`, `apps/studio/src/editor/`, `docs/design/v0.1/`, `packages/catalog/`, `apps/server/src/decks/`, `apps/worker/src/purge/`, `apps/studio/src/import/`, `apps/studio/src/export/`, `apps/server/src/operations/`

**Contract references.** C02, C03, C04, C07, C08, C10, C11, C16, C18, C21, C22 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W10 browser Home/manual editor and persisted catalog API; W11 browser import/export and actual worker API.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P05/build.md`.

- [ ] W10. Build the manual deck workspace and recovery states. Implement Home, Trash and deck lifecycle, then selection, editable text, slide ordering and undo on the real deck. Do not build Share or Present. Replace simulated drafting with real activity for the current F02/F03 intent. Design first-prompt, changes-by-slide, read-only deleted-deck and paste refusal states before wiring them. Track shell state separately from deck state. Own persisted deck lifecycle in packages/catalog and apps/server/src/decks; the worker purge owner implements the 30-day Trash purge with idempotent deletion. Store the first pending request without claiming Aira exists before P08. Add person undo/redo across fixture-agent commits and apply the P01 undo_change contract. Phone routes provide read-only deck viewing and a clear Edit on a laptop message; surrounding controls reflow at 320 CSS px. Include local accessibility-tree status/error and focus checks, with actual transcripts reserved to P09 X02. Verify its behavioral command `npm run verify:studio` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P05/checkpoints/W10/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W11. Connect version-pinned import and export journeys. Implement importing cards and explicit native/kept/flagged reports, without inventing previews for unsupported objects. Export one immutable saved deck version. Offer export now or after run, Fix or Export anyway, reattach pending results after tab close, and PDF download. Keep PNG captures internal. Prove Studio and worker render the same saved version with identical font hashes, and keep that version in both the artifact and fit report. Verify import/export live status and errors in the accessibility tree without moving focus, with actual announcement transcripts collected in P09 X02. Verify its behavioral command `npm run verify:import-export` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P05/checkpoints/W11/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] A person opens a deck from Home, edits slides and exports the saved version as PPTX, PDF or PNG. Phone viewing remains read-only. Save the actual outcome in `~/tmp/airdesign-autopilot/P05/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-05` to run the owned commands in order, namely npm run verify:studio then npm run verify:import-export. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P05/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W10 create edit reopen deck; then W11 import edit export reopen at trunk and head. Save `~/tmp/airdesign-autopilot/P05/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W10 true empty first visit and pending request; then W11 corrupt PPTX through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires no seeded Scratchpad, Welcome or retired Starred view is presented as empty; the entry flow frozen in C10 at the start of P05 persists a pending request without pretending an agent has run; and W11 requires invalid packages produce an actionable import failure and no partial deck. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W10 search no result; then W11 font substitution through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires no-result copy preserves search input and offers a clear next action; and W11 requires substitution is visible and its export consequences can be inspected. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W10 rename; then W11 kept preview missing through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires the persisted name updates the editor and Home consistently; and W11 requires the object is retained while the unavailable-preview state never pretends it is absent. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W10 duplicate; then W11 flagged Fix through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires the copy has a new deck id and independent future history; and W11 requires Fix locates the flagged item and supports returning to the export choice. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W10 Trash restore and 30-day purge; then W11 export anyway through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires restore retains the original content and history before expiry; the idempotent 30-day purge removes only expired owned decks and leaves a clear state in other tabs; and W11 requires the exported artifact includes declared kept content and records acknowledged flags. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W10 multi-slide selection; then W11 export during run through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires selection order and shift selection match the resulting batch action; and W11 requires the artifact is pinned to the chosen saved version and never includes half a change. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W10 keyboard, interleaved person undo/redo and phone view; then W11 tab closed while exporting through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires manual editing and person undo/redo across fixture-agent commits match C03 with no silent overwrite; keyboard focus and accessibility-tree status/error semantics hold, and phone deck view is read-only with usable 320 CSS px controls; and W11 requires reopening shows the same operation and retrieves its one result. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W10 deleted in another tab; then W11 failed retry and accessible status through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires the stale tab disables unavailable actions and preserves recoverable work; and W11 requires retry produces one valid artifact and retains the original diagnostics; progress and errors have correct programmatic semantics and do not steal focus, with real announcements verified in P09 X02. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W10 partial paste refusal; then W11 PDF range through the public surface. Save `~/tmp/airdesign-autopilot/P05/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W10 requires the accepted subset and refused content are explained before the user loses the original paste; and W11 requires the PDF contains only the chosen slides in their requested order without missing text. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W10 input-to-paint and Home load; W11 operation ACK and export-ready time. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P05/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P05/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P05/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W10 manual editing keeps the 16 ms render budget; propose Home usable within 2 s for 100 decks on the pinned local fixture; W11 id within 1 s; PPTX completes or fails within the 30 s worker deadline; record PDF absolute deadline in P01 for the fixture sizes. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P05/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. The agent-driven first-deck flow (F02, describe an idea and Aira drafts) first works in P08. The P05 operator review shows manual editing, import and export only. Save the operator decision in `~/tmp/airdesign-autopilot/P05/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P05/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Apply templates and owned images (P06)

**Depends on.** P05.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P06/files.txt`: `packages/brand/src/`, `apps/studio/src/templates/`, `docs/design/v0.1/templates/`, `packages/files/src/assets/`, `apps/studio/src/images/`, `docs/design/v0.1/images/`

**Contract references.** C02, C06, C07, C08, C19, C21, C23 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W12 browser templates and saved-version export; W13 browser assets and saved-version export.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P06/build.md`.

- [ ] W12. Apply versioned templates without overwriting overrides. Implement Light and Dark basics, template versions, layout families imported from masters, linked versus local properties, saved defaults and one-command application. Design insert-slide versus apply-deck modes, save and default states. A newer template version is offered, never pushed automatically. Export an applied-template deck and verify intended master/layout relationships locally. Include this exported fixture in P03R/P09 X01 for real Windows/Mac reopen and editability before any fidelity claim. Verify its behavioral command `npm run verify:brand` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P06/checkpoints/W12/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W13. Reuse safe images with nondestructive placement. Add personal library, upload/paste and free stock/icon lookup with provenance. Keep originals immutable and deduplicate by owner and content. Store crop, focal point, mask and alt text on each placement. Design quota, refusal, no-results and low-resolution states. Do not add generated images in v0.1. Verify its behavioral command `npm run verify:assets` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P06/checkpoints/W13/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] A person applies a template and adds an owned image, then exports the same version with provenance, layout and preserved source relationships intact. Save the actual outcome in `~/tmp/airdesign-autopilot/P06/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-06` to run the owned commands in order, namely npm run verify:brand then npm run verify:assets. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P06/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W12 apply look and undo; then W13 reuse image in two decks at trunk and head. Save `~/tmp/airdesign-autopilot/P06/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W12 local override; then W13 duplicate upload through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires only linked properties update and every local override is listed and retained; and W13 requires one original blob is reused with separate placements and ownership metadata. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W12 multiple masters and applied-template export; then W13 crop and focus through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires the intended master/layout family is applied without merging unrelated masters; exported relationships and local reopen are correct, with real Windows/Mac evidence required in P09 X01; and W13 requires changing one crop does not alter the original or other placements. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W12 font missing; then W13 mask export through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires the missing font is identified before apply and substitutions are deliberate; and W13 requires the exported mask and crop agree with the editor and source resolution is retained. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W12 no embedding right; then W13 alt text through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires a disallowed font is never embedded and the consequence is shown; and W13 requires the saved alt text is associated with the placed image and survives supported export. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W12 save template; then W13 SVG scripts through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires the saved template is immutable at its version and reusable by its owner; and W13 requires script and external resource execution are blocked on ingestion and render. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W12 set default; then W13 huge phone photo through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires the next new deck uses the selected version without changing existing decks; and W13 requires orientation and size are normalized within limits without blocking the editor. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W12 new version offered; then W13 stock no results through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires the newer version is offered explicitly and never silently applied; and W13 requires the search preserves the query and offers upload or another search. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W12 insert versus apply; then W13 library removal while used through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires insert adds slides while apply changes only the requested existing targets; and W13 requires removing a library listing does not break an already placed authorized asset. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W12 undo application; then W13 storage full through the public surface. Save `~/tmp/airdesign-autopilot/P06/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W12 requires one undo restores all application changes and retains unrelated later edits; and W13 requires upload refuses safely with a clear quota message and existing assets remain usable. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W12 template apply-to-paint; W13 thumbnail-ready time and crop-to-paint. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P06/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P06/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P06/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W12 provisional p95 at most 100 ms for 100 slides excluding cold fonts; cold-font wait is visible and separately measured; W13 provisional local thumbnail p95 at most 2 s for a 10 MB fixture; crop keeps the 16 ms edit frame budget. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P06/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P06/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P06/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Expose metered tools through MCP (P07)

**Depends on.** P06.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P07/files.txt`: `packages/usage/src/`, `apps/server/src/usage/`, `apps/studio/src/usage/`, `apps/server/src/mcp/`, `packages/tools/src/`, `packages/access/src/oauth/`, `apps/studio/src/agents/`

**Contract references.** C05, C06, C07, C12, C13, C14, C15, C17, C20, C21, C24 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W14 ledger command API with trusted fixture credit grants; W15 MCP reference client and real consent UI.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P07/build.md`.

- [ ] W14. Enforce weekly usage with an auditable ledger. Define week identity from the stored time zone, immutable usage events, limit-hit ids, atomic reset receipts and reservations. Both agent paths use one admission contract, with Aira weighted higher by a versioned rate table. Finish the current atomic change at limit, retain the request and keep manual editing available. Refund only platform-caused failures. Freeze timezone changes and DST in C14 at the start of P07 before implementing. Own the credit ledger and reset admission primitives here, but use trusted ledger-level fixture grants for paid-credit scenarios until P08. These are not provider webhooks or UI checkout. Imports, exports, themes and stock images consume no agent allowance. Freeze whether a User Agent may trigger automatic credit spending in C17 at the start of P07 before implementing; a remote tool cannot perform billing actions. Verify its behavioral command `npm run verify:usage` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P07/checkpoints/W14/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W15. Expose the same tools through authorized MCP. Register the documented catalog from shared domain handlers, with Effect MCP integration validated against the pinned SDK/spec. Add PKCE, per-connection rotating refresh, revocation and 30-day idle expiry. Bound responses and snapshot cursors. Keep deck deletion, billing and account actions unavailable. Design expired approval and failed app-return states. Load deck/jsx here only. This slice intentionally exposes the complete documented catalog after its file, template and image handlers exist. An earlier partial-catalog release requires a revised contract and dependency graph, not silently omitted tools. Validate resource indicators and exact token audience, and test supported client-ID metadata or registration paths against the pinned revision. Integrate the real signed approval-return flow from P01. An out-of-usage MCP result reports reset time, balance and the person-controlled reset link while retaining the request. Public vendor connections are P09 X05 and require an authorized HTTPS test endpoint/tunnel; a local reference client is sufficient for this PR, not a vendor-support claim. Record the paid two-model tool evaluation as pending P09 X03. Verify its behavioral command `npm run verify:mcp` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P07/checkpoints/W15/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] An approved MCP client edits an owned deck through scoped tools and receives consistent usage, exhausted-budget, pagination and authorization results. Save the actual outcome in `~/tmp/airdesign-autopilot/P07/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-07` to run the owned commands in order, namely npm run verify:usage then npm run verify:mcp. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P07/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W14 limit reached with saved request; then W15 connect get_context edit deck at trunk and head. Save `~/tmp/airdesign-autopilot/P07/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W14 Monday boundary; then W15 deny approval through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires one reset occurs at Monday 08:00 in the account timezone; and W15 requires refusal creates no connection and returns a clear result to the client. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W14 DST; then W15 expired approval and authenticated return through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires the weekly boundary follows the frozen local-time DST rule; and W15 requires expired approval restarts without losing client/permission context and the real signed return intent from P01 cannot redirect outside the registered client. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W14 timezone change; then W15 PKCE, audience and registration through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires changing timezone cannot grant duplicate weekly allowance; and W15 requires wrong/missing verifier and wrong-resource/audience tokens are refused; resource indicators and the pinned supported registration/client-ID metadata path work in the reference client. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W14 two-tab reset; then W15 refresh replay through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires concurrent reset requests produce one ledger event; and W15 requires refresh replay invalidates or refuses the replay according to the frozen rotation policy. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W14 fixture credit after Monday; then W15 revoked connection through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires a trusted ledger-level fixture grant after Monday does not charge for a second reset; real verified late-provider integration is owned by P08; and W15 requires a revoked connection immediately loses access and cannot refresh. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W14 platform failure refund; then W15 wrong owner through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires a platform-caused failure produces one refund linked to its debit; and W15 requires another owner cannot read a deck, job, image or capture. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W14 zero balance; then W15 stale base and out-of-usage MCP through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires the next atomic change is refused while saved work and request remain; and W15 requires stale edit batches fail atomically; an exhausted allowance returns reset time, balance and reset link, preserves the waiting request and never invokes a billing action. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W14 auto reset disabled and free operations; then W15 pagination under edits through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires fixture-funded reset admission causes no debit while disabled; imports, exports, themes and stock images cause zero agent-usage debit; and W15 requires paging neither skips nor duplicates ids under the frozen snapshot/cursor contract. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W14 fixture-funded three-reset cap and actor policy; then W15 native capture image through the public surface. Save `~/tmp/airdesign-autopilot/P07/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W14 requires trusted fixture credit permits at most three configured automatic resets; the fourth is refused and User Agent admission follows the accepted C17 spending rule without billing tools; and W15 requires capture returns the intended protocol image block plus bounded metadata. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W14 admission and ledger transaction latency; W15 warm p95 reads, edits, captures and full tools/list size. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P07/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P07/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P07/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W14 provisional p95 at most 50 ms local admission and zero duplicate debits under concurrent retries; W15 at most 20 tools and 8000 declared estimator tokens; non-image results below 20000 UTF-8 bytes; reads 500 ms, edits 1 s, captures 2 s; slow ACK 1 s. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P07/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P07/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P07/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Run Aira and complete account controls (P08)

**Depends on.** P07.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P08/files.txt`: `packages/agent/src/`, `apps/server/src/agent/`, `apps/studio/src/chat/`, `apps/server/src/billing/`, `packages/usage/src/payments/`, `apps/studio/src/settings/`, `apps/server/src/account/`, `apps/worker/src/account-deletion/`

**Contract references.** C01, C02, C03, C05, C06, C07, C14, C15, C16, C17, C22, C24 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W16 browser Aira with genuine deterministic-adapter commits; W17 account UI and verified fixture/sandbox payment/reconciliation APIs.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P08/build.md`.

- [ ] W16. Run Aira on the shared tool contract. Integrate Claude Agent SDK as the server harness without writing a second loop. Use the same authorized tools, attach selected elements or the whole deck, stream real activity, cancellation and run ids, and keep completed changes after failure. Design empty-deck prompt, changes-by-slide and quiet whole-run Undo. Turning Aira off stops it. For this PR, an injected deterministic local adapter emits genuine shared-tool commits and exercises stream, steer and cancel behavior without a paid model call. SDK binding and real-model smoke evidence are separate explicitly authorized P09 gates. A steer from a second authenticated tab joins the same active deck run. User Agent commits use the same visible working activity. Accessibility-tree status/error semantics never move focus; actual announcements are P09 X02. Verify its behavioral command `npm run verify:agent` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P08/checkpoints/W16/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W17. Reconcile credits and account controls safely. Implement one-off provider checkout and verified durable payment receipts. Keep provider choice and FX rules explicit, use sandbox only, reconcile late/duplicate events, grant credits exactly once, and never charge for Reset itself. Complete usage/agents/account settings and owned-data deletion jobs. Reconfirm payOS personal-account suitability and card-provider choice before production activation. Enforce one open payment per person; concurrent Add credits reopens that payment. Preserve the fixed consent and account-deletion retention rules. Handle verified refunds/chargebacks by removing purchased credit and flooring the spendable balance at zero while retaining audit facts. Race cancel against paid settlement without losing credit. Add an idempotent usage-reconciliation command comparing local ledger records to recorded provider/Anthropic usage; test local/sandbox receipts here. Nightly production scheduling, actual provider eligibility/FX and live reconciliation remain P09 X06 activation gates. Local deterministic provider fixtures may prove state machines but cannot claim provider integration if its sandbox is unavailable. Verify payment waiting/result/error semantics in the accessibility tree without focus theft; P09 X02 owns real announcements. Verify its behavioral command `npm run verify:billing` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P08/checkpoints/W17/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

**You see.**

- [ ] Aira makes real tool commits through the deterministic adapter, respects person edits and usage, and the account UI reconciles sandbox credits and deletion safely. Save the actual outcome in `~/tmp/airdesign-autopilot/P08/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-08` to run the owned commands in order, namely npm run verify:agent then npm run verify:billing. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P08/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W16 first-deck prompt to saved deck; then W17 sandbox payment and reset at trunk and head. Save `~/tmp/airdesign-autopilot/P08/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W16 selection context; then W17 duplicate webhook, refund and chargeback through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires only the selected scope changes and the activity names that scope; and W17 requires one verified payment id grants once; verified refund/chargeback removes only its purchased credit, floors spendable balance at zero after partial spending and retains immutable audit history. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W16 whole-deck request; then W17 forged webhook through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires the explicit whole-deck request can inspect and edit the intended slides; and W17 requires an invalid signature creates no credit and returns the documented refusal. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W16 edit alongside, second-tab steer and User Agent activity; then W17 browser return before webhook through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires manual edits stay responsive, older writes respect the epoch, a second-tab steer joins the existing run, and User Agent commits show the same truthful working activity; and W17 requires browser return shows pending until the authoritative verified event arrives. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W16 stop run; then W17 expired pending link and cancel-versus-paid through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires Stop retains accepted changes and prevents later commits from the stopped run; and W17 requires expired links do not pretend pending credit is spendable; cancel losing to authoritative paid settlement credits exactly once and shows the real terminal state. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W16 resume failure; then W17 paid after Monday through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires resume uses the saved request and current deck without duplicating accepted changes; and W17 requires credit arrives once and no redundant reset debit follows the weekly reset. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W16 usage exhausted; then W17 two pending links through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires the current atomic change completes then the run stops with an explicit next action; and W17 requires concurrent Add credits actions reopen the same one pending payment; a terminal payment can be followed by a new id without double credit. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W16 Aira disabled; then W17 credit order and reconciliation through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires disabling Aira leaves manual editing and authorized User Agent access available; and W17 requires bonus/paid consumption follows C15; replayed provider/Anthropic usage reconciliation is idempotent and reports discrepancies without inventing usage or credit. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W16 run undo summary; then W17 revoke connection through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires whole-run undo removes only run contributions, preserves later human work and lists the kept person-edited items with stable ids; and W17 requires revocation terminates the selected connection without affecting unrelated sessions. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W16 duplicate stream and accessible status; then W17 delete-account and accessible payment status through the public surface. Save `~/tmp/airdesign-autopilot/P08/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W16 requires duplicate events do not duplicate activity, changes or debits; status/error tree semantics are correct and updates retain focus, with actual announcements required in P09 X02; and W17 requires deletion obeys C16 and explicit confirmation; payment waiting/result/error roles are programmatically determinable without moving focus, with real transcripts required in P09 X02. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W16 first committed change and commit-to-paint; W17 webhook ACK and result propagation. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P08/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P08/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P08/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W16 connected paint p95 at most 100 ms; measure harness dispatch and stream overhead separately with the deterministic adapter; record real-model first-change latency as not run until an approved P09 trial; W17 provisional webhook ACK at most 1 s after durable receipt and UI result within 2 s of verified credit commit; no live charges. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P08/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P08/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P08/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Accept the release and prepare truthful discovery (P09)

**Depends on.** P08.

**Files.**

- [ ] Create or update these paths and record the actual diff in `~/tmp/airdesign-autopilot/P09/files.txt`: `bench/quality/`, `bench/release/`, `packages/lint/`, `docs/release/`, `apps/site/src/`, `apps/site/content/`, `docs/launch/`

**Contract references.** C04, C05, C07, C08, C14, C15, C20, C21, C22, C24 in [the register](contract-index.json). Contracts frozen earlier are consumed as accepted. Contracts whose freezeIn is this PR are accepted in its first checkpoint before any consumer.

**Verification surface.** W18 release harness plus actual external reference applications/clients; W19 built site browser and authorized client guide walkthroughs.

**Build.**

- [ ] Complete the ordered checkpoints below on this PR branch. Verify each checkpoint before its consumers. Preserve all scenario predicates in phase-data.json and lane-predicates.json; checkpoints do not create PRs or independent approval rounds. Save the contract and implementation receipts in `~/tmp/airdesign-autopilot/P09/build.md`.

- [ ] W18. Calibrate slide quality and verify the full release. Create the six-family 48-task release set with three samples per task, a human-vetted frozen baseline, blinded swapped-order judge results and editable-export checks. Keep failures in the denominator. Validate judge calibration with human raters before automation. Run end-to-end first deck, PowerPoint round trip, offline recovery, payment races and access isolation. Paid generation/judging is a separate approved budget gate; build local replay first. Run the separate tool capability eval on at least 40 frozen tasks, three trials per model and the branch-required Claude plus a second model, only after model availability and cost authorization. Require at least 90 percent completion, 100 percent authorization and atomicity cases and no newly failing baseline case. The requested Codex and Grok research roles do not waive this product conformance matrix. Include actual vendor-app smoke checks and SDK-bound reference-model runs when available and authorized; unresolved vendor support remains a release capability limitation. Record model first-change distributions and freeze any proposed latency target from measured user-facing trials, without borrowing the import budget. Smoke-test the branch-required Claude Code, Cursor and ChatGPT adapters, including native capture visibility, pagination and stale recovery. Verify any additional client named by published connection guides; an unavailable client cannot be advertised as supported. Close external gates X01-X06 from contract-index.json. X01 consumes P03R. Imported, natively created text/table/chart and applied-template decks must reopen without repair, retain native editability, correct masters/fonts and meet visual/line-count rules in pinned Windows and Mac PowerPoint. X02 records actual screen-reader transcripts for access, manual/offline states, import/export, Aira and account/payment flows; keyboard/tree evidence alone cannot pass it. X05 requires explicit authorization and a public HTTPS test endpoint or tunnel for the remote clients being claimed. X06 verifies supported provider sandbox integration, eligibility/FX, reconciliation and documented production-scheduling readiness without activating payments. Missing mandatory evidence leaves P09 blocked. Assign a post-release owner for monthly human judge recalibration and rerun tool evals after schema/description changes. Verify its behavioral command `npm run verify:release` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P09/checkpoints/W18/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] W19. Publish truthful discovery and connection guidance. Implement landing, pricing and agent guides from verified product evidence. Use actual product captures and real before/after PowerPoint files with provenance. Explain weekly usage, credits and export caveats accurately. Publish plain text agent instructions and operational status/recovery links. Remove unsupported claims and old share links. Prepare release and rollback instructions, stopping before deployment. Real Claude/Codex guide checks require P09 X05 endpoint/tunnel authorization. Missing endpoint/client evidence is recorded blocked and the corresponding connection guide or support claim cannot ship. Drafting the site does not authorize exposing an endpoint or deploying it. Verify its behavioral command `npm run verify:site` before the next dependent checkpoint. Save the result in `~/tmp/airdesign-autopilot/P09/checkpoints/W19/`. All retained scenarios and pass predicates in [the checkpoint data](phase-data.json) and [the predicate register](lane-predicates.json) are required, including the combined live lanes below.

- [ ] External gate X01. P03R requires real Windows/Mac PowerPoint, licensed fonts, imported/native/applied-template reopen, editability and visual evidence. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X01/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] External gate X02. Real screen-reader transcripts for P01 access, P04 offline recovery, P05 manual/import/export states and P08 Aira/account/payment flows, including focus, errors and announcements. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X02/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] External gate X03. Authorized paid models for tool eval on Claude plus a second model and actual SDK-bound Aira smoke/quality runs. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X03/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] External gate X04. Independent human raters and judge calibration under the frozen quality protocol. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X04/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] External gate X05. Available claimed vendor clients and explicitly authorized public HTTPS test endpoint/tunnel where needed. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X05/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] External gate X06. Verified provider sandbox integration, eligibility/FX and usage reconciliation, with production scheduling/activation readiness; no live charges or activation. Save actual evidence and the authorization/environment receipt in `~/tmp/airdesign-autopilot/P09/external/X06/`. Missing evidence leaves P09 blocked; local fixtures cannot check this box.

- [ ] Calibrate on 120 diverse deck pairs with three independent raters, including two presentation designers and one target reader. Require 96 of 120 candidate decks to have median overall score at least 4, and each accepted deck median at least 4 on every craft axis with zero hard defects. Automated judging is eligible only at 80 percent decisive-pair agreement and human Krippendorff alpha at least 0.60; otherwise human raters decide release. Save independent ratings and disputes in `~/tmp/airdesign-autopilot/P09/calibration/`.

- [ ] Run the frozen judge protocol in both orders. Resolve disagreements with humans and keep malformed, missing and hard-failure cases in the denominator. Aggregate three samples by task, resample 48 task means 10,000 times with a recorded seed and require the 95 percent lower utility bound at least 0.50. Require at least two passing samples per task, 44 of 48 passing tasks and seven of eight per family, plus the human quality floor. Save all outputs, task-level intervals and adjudication in `~/tmp/airdesign-autopilot/P09/quality/`.

**You see.**

- [ ] The release dossier contains the mandatory actual-reference evidence and the built site makes only proven claims. Missing mandatory external evidence blocks this PR; publication remains separate. Save the actual outcome in `~/tmp/airdesign-autopilot/P09/outcome.md`.

**Verify, unit.**

- [ ] Add behavioral coverage at the checkpoint test paths recorded in [the checkpoint data](phase-data.json). Introduce `npm run verify:pr-09` to run the owned commands in order, namely npm run verify:release then npm run verify:site. Run the aggregate command plus the root tests and typecheck. Save commands, head and full logs in `~/tmp/airdesign-autopilot/P09/unit/`.

**Verify, live.** Ten lanes at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Drive W18 first deck edit export reopen; then W19 landing to sign-in to deck at trunk and head. Save `~/tmp/airdesign-autopilot/P09/lane-1/comparison.json` and the raw responses. Add a screenshot for a UI surface or a terminal capture for CLI/API proof. Pass when existing behavior is preserved; when trunk lacks the feature, record missing and prove the new result from You see without claiming a trunk pass.

- [ ] Lane 2. Drive W18 dense content; then W19 pricing accuracy through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-2/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires hard layout and readability checks pass for the dense-content family and blinded quality meets its family floor; and W19 requires weekly usage, credit reset terms and supported export claims match the shipped ledger and capability matrix. Record actual values in the lane receipt.

- [ ] Lane 3. Drive W18 data chart accuracy; then W19 Claude guide over authorized HTTPS through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-3/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires numbers, labels and chart relationships agree with the source data; and W19 requires the guide completes a real authorized Claude connection over the approved HTTPS endpoint/tunnel; absent endpoint or client is blocked evidence, not a pass or supported claim. Record actual values in the lane receipt.

- [ ] Lane 4. Drive W18 editorial layout; then W19 Codex guide over authorized endpoint through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-4/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires hierarchy and reading order meet the frozen rubric and human-calibrated preference floor; and W19 requires the guide completes a real authorized Codex connection using its supported transport; absent required endpoint or client is blocked evidence, not a pass or supported claim. Record actual values in the lane receipt.

- [ ] Lane 5. Drive W18 non-Latin text; then W19 plain text guide through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-5/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires mixed scripts shape correctly without substituted missing glyphs or clipped lines; and W19 requires the plain-text instructions carry equivalent connection and revoke information. Record actual values in the lane receipt.

- [ ] Lane 6. Drive W18 image-led deck; then W19 keyboard navigation through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-6/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires images have permitted provenance and the layout passes the frozen quality rubric; and W19 requires all interactive links, menus and sign-in entries work with visible keyboard focus. Record actual values in the lane receipt.

- [ ] Lane 7. Drive W18 technical diagram; then W19 mobile reading through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-7/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires diagram labels and connectors express the source relationship without clipping; and W19 requires the text and navigation reflow on the pinned narrow viewport without page-wide overflow. Record actual values in the lane receipt.

- [ ] Lane 8. Drive W18 judge-order reversal; then W19 contrast through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-8/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires randomizing judge order does not create a statistically unexplained preference reversal; and W19 requires measured text and control states meet the adopted contrast requirements. Record actual values in the lane receipt.

- [ ] Lane 9. Drive W18 hard defect despite beauty; then W19 real export evidence through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-9/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires any hard correctness or accessibility defect fails regardless of aesthetic score; and W19 requires every quality and export example is produced by the release head and linked to its receipt. Record actual values in the lane receipt.

- [ ] Lane 10. Drive W18 retired sharing absent; then W19 broken-link scan through the public surface. Save `~/tmp/airdesign-autopilot/P09/lane-10/receipt.json` and its trace. Add a real screenshot for a UI surface, or raw structured responses and a terminal capture for CLI/API proof. Pass when W18 requires route and UI scans expose no retired sharing entry or share-link promise; and W19 requires the generated site contains no broken internal links or unsupported routes. Record actual values in the lane receipt.

**Verify, perf.**

- [ ] Metric. Measure W18 end-to-end latency, memory and case-level quality statistics; W19 static-page load and build artifact size. Save sample definitions and the measured limiter in `~/tmp/airdesign-autopilot/P09/perf/metric.json`.

- [ ] Probe. Add a reproducible probe beside each checkpoint test path. When trunk has comparable work, run it first, then at least 20 interleaved warm samples plus separate cold trials; a p95 comparison needs at least 100 warm samples per comparable revision and uncertainty. While trunk has no comparable product code, the gate is the absolute C07 budget. Do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Documentation-only follow-ups may record N/A with a reason and proof of no runtime diff. Save raw data or the justified N/A in `~/tmp/airdesign-autopilot/P09/perf/`.

- [ ] Baseline. While trunk has no comparable product code, do not build trunk-comparison rigs or collect interleaved trunk samples for absent features. Lane 1 records the feature as absent. Save the comparable trunk result, or evidence the feature is absent, in `~/tmp/airdesign-autopilot/P09/perf/baseline.json`. Measure the exact added operation and user end state at head when no comparable trunk surface exists.

- [ ] Rule. Fail when the following acceptance rule is unmet. W18 enforce all P02/P04/P07 latency limits and zero authorization/atomicity failures; quality thresholds are frozen policy and require calibrated human evidence; W19 provisional LCP at most 2.5 s under a pinned mobile network profile; record trunk comparison only for equivalent pages. Apply the provisional 10 percent relative p95 rule only to comparable operations with sufficient evidence; investigate noise and report inconclusive rather than inventing a regression. A justified docs-only N/A may pass the perf box. Save `~/tmp/airdesign-autopilot/P09/perf/verdict.json`.

**Review gate.**

- [ ] Show the operator the real before/after screenshot and a short video of the changed interaction, including its failure path. Save the operator decision in `~/tmp/airdesign-autopilot/P09/operator-review.md`. Wait for that decision before merge.

**Merge.**

- [ ] Report the ready PR URL, head, all required evidence and remaining external gates in `~/tmp/airdesign-autopilot/P09/handoff.md`. Stop for the operator to merge. An unchecked verification box means this PR is not merge-ready.

## Close the program

- [ ] Check P01 through P09 against their exact heads and evidence manifests. Summarize passed, failed and externally blocked gates in `~/tmp/airdesign-autopilot/program/release-verdict.md`. Do not average away a failure in a quality family or authorization case.
- [ ] Demonstrate a real individual workflow from email sign-in to imported deck, manual edit, authorized agent edit, stop, human edit, selective undo, reconnect and editable PPTX export. Include PDF, usage exhaustion and disconnect recovery. Save the video and exported fixture hashes.
- [ ] Confirm no Share routes, fake drafting, unsupported lossless claims or unfinished payment UI remain in the release. Save the route/copy audit and the capability matrix.
- [ ] Rehearse backup restore, deletion, worker interruption and rollback on disposable fixtures. Document data retention and exact rollback boundaries. Production publication remains a separate explicit decision.
- [ ] Hand off the source heads, PRs, tests, live receipts, benchmark distributions, known limitations, operator decisions and cleanup list. Audit the decision trail with a fresh reviewer from the other requested model family.

## Appendix A. Prototype evidence

The repository has no production application yet. Retained research probes provide narrowly scoped evidence; rerun their own documented checks at the execution head.

| Probe | What is established now | What still gates the plan |
|---|---|---|
| UI workspace | Planning and design handoff only; no current root product tests | P01 creates and checks the packed UI consumer and signed-in shell |
| Sync | Ten tests pass with a 30 s test timeout | Default check times out on one case here; verify install hits EALLOWSCRIPTS. Permanent human protection differs from the intended run policy. Structural edits, production Postgres and process crashes are not proven |
| PPTX | Synthetic preserved-part probe inspected, not rerun by root | Real Windows and Mac reopening, relationship closure, fonts, unsupported elements and visual corpus |
| Tools | Stdio stub/schema-budget prototype inspected, not rerun by root | Remote OAuth, real deck operations, transport, authorization and calibrated task eval |
| Quality | Five-fixture layout probe inspected, not rerun by root | Human-calibrated stunningness, real-deck corpus and blinded comparison |
| Design | Exported boards and UI logic reviewed | States on a live production implementation, assistive technology and breakpoint behavior |

Use each research README for its recorded evidence, source paths and limitations; rerun the checks before treating those observations as current. External gates remain unchecked. Do not replace real PowerPoint with a screenshot renderer or model quality with deterministic fixtures.

## Appendix B. Alternatives rejected

- Generating all target packages first gives a large empty dependency graph. Introduce a package only with an executable consumer.
- A CRDT first does not settle the required human-versus-agent authority or selective run undo. Use the specified server order and explicit run epochs, then test multi-connection behavior.
- Converting arbitrary PPTX to one flattened image loses editable semantics. Keep unknown source parts and provenance beside native elements. Label kept and flagged content honestly.
- Build from shadcn/ui primitives and the v0.1 handoff. Do not hand-roll keyboard behavior those primitives provide.
- A scripted fake drafting state cannot establish live collaboration. Real accepted commands drive the canvas and activity timeline.
- A GPU renderer is not chosen without a measured DOM/SVG bottleneck. Preserve native text input, IME and accessible representations.
- Combining model orchestration with every module duplicates the edit boundary. Keep Aira as a harness over the same authenticated tools used by remote agents.

## Appendix C. Risks

| Risk | Gate and response |
|---|---|
| Real PowerPoint access or licensed fonts unavailable | P01 inventories missing evidence. P03 local engine can merge without support claims; P03R feeds mandatory P09 X01 Windows/Mac/font acceptance. P09 and dependent release claims remain blocked, while P01-P08 local work can progress |
| Structural run undo has ambiguous ownership | P01 freezes create/move/delete/adoption rules; P04 produces counterexamples and transactional tests before syncing clients |
| P01 decisions require operator preference | Recommend explicit defaults in research report; request only the still unresolved decision, with its alternatives and affected boxes |
| Deep UI boards omit edge states | P05-P08 include the journey matrix from research. Never infer behavior solely from the PNG |
| Proposed package/test paths and budgets are not current implementation | Each PR introduces its command and public seam. Provisional budgets are adopted or revised with evidence in P01 |
| Missing actual screen reader | P01/P04/P05/P08 local keyboard/accessibility-tree evidence cannot claim announcement success; real transcripts are mandatory P09 X02 release evidence |
| No installed control skills or cloud VM fleet | Use the actual supported terminal/browser controls and isolated contexts. Record the environment; no claim of VM coverage |
| Paid model, stock or provider cost | Free fixtures and sandbox only during authorized engineering. Paid quality trials, public HTTPS test endpoint/tunnel exposure, production billing and publication need explicit authorization; P09 X03/X05/X06 remain blocked without it |
| MCP and provider contracts evolve | Pin spec/SDK versions at execution, recheck primary docs and conformance tests. No assumption that a pinned historical prototype is current |
| Shared CSS and config invite concurrent writes | P01 owns token and workspace changes; later owners consume versioned contracts or queue changes to that owner |
| Data deletion can conflict with retention and payment audit | P01 C16 freezes retention and user-visible consequences; P05 owns 30-day Trash purge and P08 implements account deletion. Provider/legal facts must be resolved before activation |

## Appendix D. Links and reading list

- Study source at `https://github.com/Rickvu309/AirDesign/tree/012c3dc74166fa036aa4e3b71b9d6f1042ae86e1`.
- Planning authority in `docs/planning/v0.1/README.md`, `content/monorepo-map.md`, `content/key-components.md`, `content/journey-flow.md` and research subdirectories.
- Design authority in `docs/design/v0.1/README.md`, `logic.md`, `backlog.md`, `copy-kit.md` and screen PNGs.
- [Checkpoint data](phase-data.json), [scenario predicates](lane-predicates.json) and [contract register](contract-index.json) retain the detailed reviewed delivery criteria.
- Primary sources for PowerPoint, synchronization, MCP and quality gates are linked and scoped in the repository research READMEs. Recheck current docs at implementation time.


The five phases are delivery milestones. Follow the linear P01-P09 stack and checkpoint order inside each PR. P01 owns shared bootstrap, access and token files; later PRs update them sequentially. P03 uses actual P01 principals. P04 depends on P02 document/render and P01 access, both present on its parent. P06 consumes saved-version export from P05. W14 precedes W15 inside P07, and W16 precedes W17 inside P08. W18 actual acceptance precedes the verified claims and guide walkthroughs in W19 inside P09. P08 does not authorize real payment activity. P09 prepares a site and launch evidence; it does not deploy it. X01-X06 and actual guide evidence remain mandatory. Checkpoints can stop at a failed local check without becoming extra PRs.

## Appendix E. Preserve the reviewed requirements within nine PRs

The historicalPRMap in [the checkpoint data](phase-data.json) records consolidation of the earlier scope labels; only the nine PRs below are delivery boundaries. The active plan uses only P01-P09. Each earlier scope now has an internal W identifier. The checkpoint dependency graph proves that a consumer is either later within its owning PR or on a later PR; shared files have one sequential writer. This does not infer every prose dependency.

Moving bootstrap and real authentication into P01 removes the former worker-before-auth dependency. W05 uses that boundary in P03. Cross-owner job tests therefore run in P03, while P01 proves the account boundary and P04 proves deck isolation. This is an intentional sequencing change, not a deleted security case.

The throughput check is nine PR heads, nine final verification rounds and nine operator merge boundaries. Keep one handoff per PR and reuse checkpoint receipts only when their pinned head and relevant inputs remain valid. Do not run nineteen independent PR reviews under W labels. Local checkpoint checks still run before dependent work. The detailed contract decisions, scenario predicates and external acceptance gates remain required after consolidation.

