# AirDesign v0.1: tool surface fixed points

Research date: 2026-11-03. Recommendation: **18 tools**, one shared service and authorization path for the built-in Agent and OAuth User Agents. AirDesign supplies an interface and tools; workflows remain agent decisions. Budgets below are proposed acceptance gates, not established universal optima.

## Findings and evidence

[Anthropic](https://www.anthropic.com/research/writing-tools-for-agents) recommends task-shaped tools, clear descriptions, meaningful returned context, filtering/pagination and actionable errors, evaluated on realistic tasks. More tools introduce selection ambiguity; fewer tools can hide ambiguity inside action enums. Neither tool count nor schema length alone establishes agent success. Measure wrong-tool calls, invalid arguments, calls/task, tokens, latency and end-state correctness together. Compact descriptions must still explain scope, defaults, stale writes and recovery.

The [current MCP specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) is **2026-07-28**: tools use JSON Schema; structuredContent conforms to outputSchema when declared; serialized text alongside it supports older clients. Execution failures use isError; protocol failures remain separate. Native image blocks and resource links are supported. Deterministic tool ordering aids caching; tools/list pagination is separate from business-result pagination.

[Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) are URI-addressed and application-driven. Use them for full artifacts, but retain read tools because clients differ in resource discovery. [OAuth](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) requires protected-resource metadata and OAuth 2.1; current guidance prefers Client ID Metadata Documents and deprecates dynamic registration. [PKCE/security requirements](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx) include checking PKCE support. Validate token audience, issuer, scopes and resource ownership on every call; annotations are hints, not authorization.

T3 checkout examined: `cefb544af3c98224874419198c0359b652ca3c94`:

- [Toolkit](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/mcp/toolkits/thread/tools.ts): Effect Tool/Toolkit declarations separate schemas from handlers.
- [Schema compaction](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/mcp/advertisedJsonSchema.ts) removes redundant schema noise; runtime decoding keeps full validation. Flattened unions risk hiding per-operation requirements. Preserve discriminated operation branches initially.
- [Budget test](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/provider/AgentContextBudget.test.ts) measures actual registered names/descriptions/inputSchema against a committed budget; CI guards increases. Its committed tool-list baseline is 47,538 bytes, not an AirDesign target.
- [InvocationContext](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/mcp/McpInvocationContext.ts) carries caller scope; [access wrappers](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/mcp/McpToolAccess.ts) constrain registration and apply access checks. Borrow that structure, substituting deck permissions for harness runtime modes.
- [Preview bounding](https://github.com/pingdotgg/t3code/blob/cefb544af3c98224874419198c0359b652ca3c94/apps/server/src/mcp/McpHttpServer.ts#L251) caps snapshot text at 20,000 UTF-8 bytes, preserves locators and reports omissions. This is snapshot-specific, not a universal T3 result cap.

Design precedents: [Figma](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) separates lightweight XML metadata, React/Tailwind design context and screenshots. [Canva](https://www.canva.com/help/mcp-canva-usage/) currently groups nine design tools into read_design/edit_design in Claude; this supports consolidation, without proving an optimal count. [Paper](https://paper.design/docs/mcp) exposes HTML/CSS read/write and claims efficiency; it publishes no comparative benchmark there. [Wonder](https://wonder.design/changelog/grid-capture-and-mcp) reports leaner responses, retry-aware errors and read-only viewer access. Borrow these patterns; their catalogs are product/client-specific.

**JSX versus JSON:** default get_slide to restricted JSX for readable hierarchy/text and familiar styling; retain JSON for exact values and debugging. JSON remains authoritative. JSX must parse as data: allowlisted tags/Tailwind utilities, escaped text, stable ids, no expressions, imports, scripts or arbitrary CSS. Require lossless JSON → JSX → JSON fixtures. No reviewed source proves JSX improves slide-edit success: compare paired JSON/JSX tasks before committing the default. Do not return both representations automatically.

## Catalog review

Notation: `D/S/V` = deck/slide/version; `P` = cursor/limit; `W` = baseVersion/requestId. All outputs use the common envelope below. Lists return nextCursor and bounded summaries.

| Tool | Decision and purpose | Inputs → output sketch |
|---|---|---|
| get_deck | Keep: outline, not every element | D,P → V, slide ids/titles |
| get_slide | Keep: targeted content | D,S,rootId?,format,P → V, complete JSX/JSON subtrees,nextCursor |
| get_context | Merge get_selection/get_preferences | none → active D,V,selection ids,brand id,preferences |
| get_brand | Keep: applicable tokens/rules | brandId → brand V,tokens,assets,rules |
| find_elements | Keep: locate without scanning | D,query?,kind?,P → ids,slide ids,snippets |
| list_decks | Keep: discovery | query?,P → ids,titles,V |
| search_assets | Merge list_files/search_images | query?,source?,P → file ids,metadata,provenance |
| read_file | Keep: bounded inspection | fileId,offset?,length? → metadata,text range or resource link |
| add_file | Keep: ingest external/uploaded assets | sourceUrl,name,requestId → fileId,metadata |
| export_deck | Keep: pinned export | D,V,format,requestId → operationId or file link,expiry |
| import_deck | Keep: import into new deck | fileId,requestId → operationId,fidelity notes |
| apply_changes | Keep: sole general canvas mutation | D,W,insert/set/move/remove[] → V,changeId,changedIds,idMap |
| create_deck | Keep: empty branded deck | title,brandId?,requestId → D,V |
| update_brand | Rename save_brand; explicit token edits | brandId,W,tokens → brand V |
| capture_slide | Keep: visual evidence | D,S,V,width?,format? → native image,V,dimensions |
| check_deck | Keep: actionable diagnostics | D,V,checks?,P → element ids,severity,fix hints |
| get_operation | Add: bounded async status | operationId → pending/ready/failed,pollAfterMs,links |
| undo_change | Add: recover named edit | D,W,changeId → V,inverse changeId or conflict |
| apply_look | Cut separate tool | Explicit theme/style sets through apply_changes; optional recipes |

`remove` cannot target the deck root. insert/move must support slides as well as elements; temporary ids resolve through idMap. Brand creation stays in the UI for v0.1. add_file uses authorized upload URLs or server-fetched HTTPS, never agent-local paths/base64. Validate fetch destinations and redirects. Operation polling suggestions respect rate limits.

## Seven enabling constraints

1. **Surface budget:** ≤20 advertised tools; ≤8,000 approximate tokens for the complete tools/list envelope. Snapshot actual registered schemas in CI, including descriptions/output schemas; also measure model-visible fields separately. Growth requires a task-eval comparison, not prose trimming alone.
2. **Bounded context:** non-image CallToolResult JSON <20,000 UTF-8 bytes, including duplicated structured/text content and omission notes. Default pages 20, maximum 50, further limited by bytes. Snapshot-bound opaque cursors prevent duplicates/skips under concurrent edits. Never silently truncate JSX/JSON mid-node; retain ids and a continuation route. Oversized single items require subtree/range reads.
3. **Atomic writes:** every mutation uses requestId; existing-resource writes require baseVersion. Validate all operations before commit, increment once, return stale conflict without side effects. Persist deduplication keyed by principal/resource/requestId; changed-payload reuse fails. Race, replay, rollback and undo tests must pass.
4. **Shared access boundary:** Effect InvocationContext carries authenticated principal, scopes and request id. One wrapper enforces deck/brand/file ownership and rate limits for both agent types. Negative access tests must all pass. No deck deletion, billing/account tools or User Agent credit debits.
5. **One domain-error shape:** `{ok:false,error:{code,message,retryable,recovery,currentVersion?}}`, with isError:true; success `{ok:true,data,omitted?}`. Recovery names a concrete read/rebase/filter action; retryable means unchanged retry can help. HTTP OAuth/protocol errors retain their prescribed transport shape.
6. **Useful visual latency:** proposed warm p95 ≤500ms targeted reads, ≤1s edits, ≤2s captures; slow imports/exports acknowledge within 1s with operationId. Capture one pinned slide, default 1280px, ≤500KB compressed; use native image content, not base64 text. Measure image processing cost separately; base64 adds roughly one-third transport size. Cache by version/render settings; keep full resolution as a resource with expiry metadata.
7. **Behavior gate:** before tool/schema changes, ≥90% task completion on ≥40 fixed tasks, three trials/model, on Claude plus a second model. Require 100% authorization/atomicity cases and no newly failing baseline case. Smoke-test Claude Code, Cursor and ChatGPT adapters; include capture visibility, pagination and stale recovery. Skills must remain optional; no forced call sequence.

## Prototype and verification

Node 22.17.1/npm 10.9.2; pinned dependencies and lockfile. From this folder, clean dependency installation plus checks is one command:

```sh
npm ci --cache .npm-cache --no-audit --no-fund && npm run verify
```

Start interactive stdio separately: `npm run server`. No comments in source.

Verified output:

```text
CATALOG tools=18 utf8_bytes=17840 approximate_tokens=4460
model_fields_bytes=8092 model_approximate_tokens=2023
RESULT full_bytes=573891 bounded_envelope_bytes=19240
omitted=986 recovered=1000 pages=72 oversized_item=actionable_error
MCP tools=3 initialize/list/read/write/rollback/replay/stale/image=PASS
protocol=2025-11-25
```

Full stdout is in `verification.txt`. The result measurement includes the entire tool-result envelope, its escaped text JSON, structuredContent and omission note; image payloads have a separate proposed budget.

The estimator is ceil(UTF-8 bytes/4), not a model tokenizer. Schemas are catalog sketches: open token/property/output data objects undercount production contracts. Re-measure generated Effect registrations before release.

The three-tool SDK stub verifies actual MCP initialization/list/read/write, atomic rejection, idempotent replay, stale rejection and native image delivery. It supports set-text only and returns a **1×1 PNG fixture**, not rendered slides. It uses the pinned SDK's legacy protocol, not Effect McpServer or 2026-07-28 conformance. Those integrations, real rendering, latency and model evals remain unverified.

Top risks: schema compression concealing required arguments; client duplication/resource/image differences; lossy JSX or PowerPoint conversion; concurrent editing and nonpersistent deduplication. The prototype proves transport and budget mechanics, not agent task success.
