# Local PowerPoint import

The API accepts an authenticated P01 session and a bounded local base64 upload. A request key is unique per person and immutable for its input digest. Repeated submission returns the same operation. Submit, status, cancel and artifact retrieval all load the real P01 principal. Cross-owner operations return 404.

The existing server defaults to persistent private PGlite storage under `~/.local/share/airdesign/access`. Override it with `AIRDESIGN_ACCESS_PATH`, or use the existing Postgres configuration. Set `AIRDESIGN_OPERATIONS_PATH` to the SQLite file shared with the worker. Run `npm run worker:once` to recover abandoned leases and drain queued work. This worker is a finite command; a process supervisor must invoke it for ongoing delivery. The development inbox remains controlled by the existing P01 switch.

```sh
npm run operations -- submit http://127.0.0.1:41732 ~/tmp/session-cookie.txt fixtures/pptx/preservation.pptx import-001
npm run worker:once
npm run operations -- status http://127.0.0.1:41732 ~/tmp/session-cookie.txt OPERATION_ID
npm run operations -- artifact http://127.0.0.1:41732 ~/tmp/session-cookie.txt OPERATION_ID ~/tmp/result.pptx
npm run operations -- cancel http://127.0.0.1:41732 ~/tmp/session-cookie.txt OPERATION_ID
```

Cookie files must contain an existing session cookie, one line. Keep them private. The server does not accept filesystem paths or URLs, so no redirect is followed. HTTP body collection is bounded before decoding. Artifacts expire after seven days with `submit-again` recovery. Cancellation and completion compare the current lease atomically. A stale worker cannot replace a result. Abandoned running leases retry at most three attempts. Restart uses the same database and stable operation id.

Parsing runs under a Linux user systemd scope, `MemoryMax=536870912`, zero swap, one CPU, `prlimit` CPU 25 seconds and file size 500 MiB, plus a 30-second wall deadline. Bubblewrap unshares all namespaces, denies network, exposes a private writable job directory and read-only program files, clears the environment and hides the home directory. No Docker or root is required. A Linux user manager with delegated cgroups and unprivileged bubblewrap is required; missing isolation fails closed. Cleanup removes the exact lease directory after success, cancel, failure or crash recovery. Fonts receive bounded SFNT directory validation inside that worker; none are passed to a native font engine or declared licensed. Other font formats fail closed. No Chromium work runs in the API.

The engine retains original OPC payload bytes and resolves the internal relationship graph. It rejects dangerous ZIP/XML/SVG/font content and explicitly lists removed macro, active embedding and external relationship payloads. Inert chart workbooks remain original bytes until edited. Untouched parts stay byte-identical, including unknown XML. Native text writes replace only one qualified text span; tables require one span per cell. Numeric chart edits require the exact Sheet1 range, cache order, worksheet relationship and numeric cells. Shared dependencies use copy-on-write. Shape movement changes an existing position only. Fresh native generation is constrained to text, rectangles, tables and bar charts; imported decks are never rebuilt with PptxGenJS.

```sh
npm run pptx -- roundtrip fixtures/pptx/preservation.pptx ~/tmp/roundtrip.pptx
npm run pptx -- patch-text fixtures/pptx/preservation.pptx ~/tmp/text.pptx ppt/slides/slide1.xml 0 'Changed title'
npm run pptx -- patch-table fixtures/pptx/preservation.pptx ~/tmp/table.pptx ppt/slides/slide1.xml 0 1 1 77
npm run pptx -- patch-chart fixtures/pptx/preservation.pptx ~/tmp/chart.pptx ppt/charts/chart1.xml 0 77,88
npm run pptx -- move fixtures/pptx/preservation.pptx ~/tmp/move.pptx ppt/slides/slide1.xml 800 100 200
npm run pptx -- native - ~/tmp/native.pptx
```

The offline PPTX CLI reads local trusted files in its process. Use the authenticated isolated job path for hostile uploads. CLI receipts include source part hashes, relationships, security removals, unresolved fonts and the P09 X01 gate. A local `native` label proves a selective writer for a named text span; it does not prove that an entire slide, chart, group or PowerPoint application is supported. Whole parts remain `kept`. Rendering previews are null. Original application metadata is preserved without attesting to its claims.

Run `npm run verify:pr-03`. Reproduce combined authenticated CLI lanes and performance with `node apps/worker/test/probe.ts ~/tmp/airdesign-autopilot/P03`. It uses disposable private storage, real P01 sign-in, diagnostic isolation probes and the production worker command; it stops the server and removes disposable databases on completion. It does not automate PowerPoint. See [P03R](P03R.md) for the external batch and open reference checks.
