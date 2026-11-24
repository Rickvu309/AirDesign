# Font layout fixtures

On the development machine, use Node 24 and run:

```sh
node tests/browser/font-layout/prepare-shelf.mjs
flock /home/quanvm/tmp/browser-4485.lock pnpm test:browser font-layout.spec.ts --workers=1
```

The Playwright action fills the shelf in CI before the spec runs. The cache key includes `faces.json`, which pins the upstream font revisions and SHA-256 hashes. The spec reads and verifies every font before opening the fixture page. It fails on missing bytes or any external browser request. The two Liberation Sans Narrow faces come from the repository. HarfBuzz and Chromium's FontFace receive the same bytes.

## Geometry baseline

The differential uses the six fixed widths plus probes 0.5 CSS px above and below the candidate advances from the beginning of each paragraph. Each later start reached by an ICU wrap contributes the same threshold probes from that line's start. The suite pins every shared and Chromium line range across 3,372 probes for 97 cases.

Each probe in `line-ends.json` has a width in CSS pixels, shared UTF-16 ranges, native UTF-16 ranges, and any geometry differences. A vertical bar separates ranges. Each range uses an exclusive end. The `line-count` flag means the engines produced different row counts. The `overflow` flag means only one engine had a row wider than the probe by more than one Chromium layout unit (1/64 px). A row may overflow in both engines by different amounts. The report preserves those widths.

`parity.json` keeps the original prototype widths. Cases added after the prototype record their widths in `line-ends.json`. Unwrapped advances have a tolerance of 0.0001 px. The 0.5 px tolerance applies to the comparison with controlled Chromium paint using assigned served faces and full-width punctuation, and to the historical #1625 measurements.

Each case with a line-end difference names its policy in `line-ends.json`. The original widths produce 123 differences and the later starts add 159, for a total of 282. When Chromium reports a local Noto Color Emoji face in the Geist-only ZWJ case, its separately pinned result adds two differences at the original widths and one at a later-line width. All 96 `punctuation-glue` probes agree. The soft-hyphen regression checks that Chromium's generated hyphen counts toward the first row's width and the following letter starts the second row.

| Category                              | Original | Later starts | Policy before switching paint                                                                           |
| ------------------------------------- | -------: | -----------: | ------------------------------------------------------------------------------------------------------- |
| Native paint used an OS face          |       51 |          121 | Refuse geometry-changing edits that require an unserved cluster. These controls can continue to differ. |
| CJK punctuation trim                  |       16 |            5 | Match line-sensitive OpenType `halt` and `chws`, including fallback.                                    |
| Space after an emoji or RTL run       |       30 |           16 | Decide when a space hangs and when it moves to the next line.                                           |
| URL and slash breaks                  |       13 |           12 | Choose Blink's unbroken URL or ICU's slash breaks and pin the overflow behavior.                        |
| Break before an ellipsis              |        6 |            3 | Choose Blink's break after a space or the UAX #14 LB13 rule.                                            |
| Chromium used a different served face |        5 |            1 | Assign the served emoji face explicitly and check its keycap width.                                     |
| Line-edge shaping                     |        2 |            1 | Shape the final line in context and decide the wrap tolerance.                                          |

The historical Han control starts two Linux Chromium processes with private Fontconfig profiles. It checks that only the profile with the pinned Noto Sans JP face uses a local font for the two uncovered glyphs in `Geist 収益 uncovered`. The expected selection width grows from 389.45 px to 424.66 px. The main baseline records the Linux font inventories observed locally and in CI. Windows and macOS face inventories remain part of step 3.

## Engine revisions

The suite checks the installed HarfBuzz, ICU and bidi-js package versions, the HarfBuzz runtime version, and the SHA-256 of the ICU WASM and its embedded data. Engine notices are in [HarfBuzz](../../../packages/fonts/licenses/HarfBuzz.txt), [ICU](../../../packages/fonts/licenses/ICU.txt) and [bidi-js](../../../packages/fonts/licenses/bidi-js.txt).

The [Unicode 16.0.0 test data](https://www.unicode.org/Public/16.0.0/ucd/) includes GraphemeBreakTest, LineBreakTest and BidiCharacterTest. ICU runs both break suites. Bidi-js runs BidiCharacterTest. The ICU reference passes explicit UTF-16 lengths to preserve embedded NULs and checks dictionary breaks for Thai, Khmer and Lao.

## Shared engine in comparison mode

The comparison samples styled paragraphs through Doom's existing measure and records advances and line ends. The legacy result still drives geometry. A sample includes up to 512 UTF-16 units and 64 candidate shapes. Each adapter keeps one sample in flight and starts samples at least 250 ms apart.

Set `VITE_COMPARE_FONT_LAYOUT=1` when running the web development server. For the API, set `NODE_ENV=development AIRDESIGN_COMPARE_FONT_LAYOUT=1`. Look for `Served font comparison` in each console. The records contain offsets, advances, cache counts, and elapsed time. Both engines use `und` and automatic direction because deck text has no locale or direction fields.

The shipped ICU module keeps grapheme and line rules, their dictionaries, and the data those operations and script and emoji selection need. To rebuild it, activate Emscripten 4.0.23, check out ICU at `release-77-1`, and run `bash packages/fonts/wasm/build-icu.sh <icu-checkout> <empty-build-directory>` from the repo root. The browser spec checks the WASM hash and its 4.8 MB raw and 2.8 MB gzip budgets. The build copies the licence notices beside the browser assets.

HarfBuzz keeps font files by revision and SHA-256. The cache has a 48 MiB font byte budget. The local binding patch releases font instances, faces, and blobs on eviction. WASM can reuse freed space within its existing memory pages.
