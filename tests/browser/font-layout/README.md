# Font layout fixtures

On the development machine, use Node 24 and run:

```sh
node tests/browser/font-layout/prepare-shelf.mjs
flock /home/quanvm/tmp/browser-4485.lock pnpm test:browser font-layout.spec.ts --workers=1
```

The Playwright action fills the shelf in CI before the spec runs. The cache key includes `faces.json`, which pins the upstream font revisions and SHA-256 hashes. The spec reads and verifies every font before opening the fixture page. It fails on missing bytes or any external browser request. The two Liberation Sans Narrow faces come from the repository. HarfBuzz and Chromium's FontFace receive the same bytes.

## Geometry baseline

The differential uses the six fixed widths plus probes 0.5 CSS px above and below the candidate advances from the beginning of each paragraph. Each later start reached by the step 1 reference contributes threshold probes. The differential runs the shipped engine at those same widths. The suite pins every shared and Chromium line range across 3,372 probes for 97 cases.

Each probe in `line-ends.json` has a width in CSS pixels, shared UTF-16 ranges, native UTF-16 ranges, and any geometry differences. A vertical bar separates ranges. Each range uses an exclusive end. The `line-count` flag means the engines produced different row counts. The `overflow` flag means only one engine had a row wider than the probe by more than one Chromium layout unit (1/64 px). A row may overflow in both engines by different amounts. The report preserves those widths.

`parity.json` keeps the original prototype widths. Cases added after the prototype record their widths in `line-ends.json`. Unwrapped advances have a tolerance of 0.0001 px. The 0.5 px tolerance applies to the comparison with controlled Chromium paint using assigned served faces and full-width punctuation, and to the historical #1625 measurements.

The shipped line breaker agrees with Chromium on 3,225 of 3,372 Linux probes. Each remaining line-end difference has a policy in `line-ends.json`. The alternate native Noto Color Emoji result is pinned separately.

| Category                          | Shipped rule                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| Trailing space after emoji or RTL | Hang trailing spaces on the preceding line.                                               |
| Break before ellipsis             | Use ICU's break opportunities, including its prohibition before infix punctuation.        |
| Different served face             | Choose the served emoji face for color presentation and keycaps.                          |
| Line-edge shaping                 | Reshape each chosen line with its own context.                                            |
| Native paint used an OS face      | Use the supplied served stack. Paint a question mark in Geist if it has no covering face. |

HTTP URLs stay together and can overflow, as in Chromium. CJK uses contextual `halt` and `chws` without fitting a closer by trimming the line end. Both policies agree with Chromium on this corpus.

The bake parity suite loads the pinned font bytes through the editor's measure adapter and the API's legacy cache. Each fixture puts text and a sibling in an auto-layout row and checks that an agent's saved boxes are within 0.5 slide px of the painted boxes or that the tool refuses the batch. The suite tests intrinsic and fixed text widths. With both measures available, the API declines a bake if any saved box differs from the shared engine's box by more than 0.5 slide px. The suite also checks the English business sample in each built-in theme and the Japanese sample in Noto Sans JP.

The historical Han control starts two Linux Chromium processes with private Fontconfig profiles. It checks that only the profile with the pinned Noto Sans JP face uses a local font for the two uncovered glyphs in `Geist 収益 uncovered`. The expected selection width grows from 389.45 px to 424.66 px. The main baseline records the Linux font inventories observed locally and in CI. Windows and macOS face inventories remain part of step 3.

## Engine revisions

The suite checks the installed HarfBuzz, ICU and bidi-js package versions, the HarfBuzz runtime version, and the SHA-256 of the ICU WASM and its embedded data. Engine notices are in [HarfBuzz](../../../packages/fonts/licenses/HarfBuzz.txt), [ICU](../../../packages/fonts/licenses/ICU.txt) and [bidi-js](../../../packages/fonts/licenses/bidi-js.txt).

The [Unicode 16.0.0 test data](https://www.unicode.org/Public/16.0.0/ucd/) includes GraphemeBreakTest, LineBreakTest and BidiCharacterTest. ICU runs both break suites. Bidi-js runs BidiCharacterTest. The ICU reference passes explicit UTF-16 lengths to preserve embedded NULs and checks dictionary breaks for Thai, Khmer and Lao.

## Shared line layout

The editor, filmstrip, slide capture, and PDF use the shared engine's line ends and face assignments. Paragraph direction is automatic. A text layer can set its language or inherit the deck's language.

The engine keeps HTTP URLs together and attaches trailing spaces to the preceding line. Other opportunities, including breaks around ellipses, come from ICU. A displayed discretionary hyphen keeps its original source offset. HarfBuzz reshapes each chosen line and applies contextual CJK punctuation spacing. The engine requests script faces when the primary served stack lacks a cluster. Without a set language, Han fallback uses one result for the deck. Kana selects Japanese, Hangul selects Korean, and Traditional-only ideographs or Bopomofo select Traditional Chinese, in that order. The default is Simplified Chinese. An uncovered cluster paints a question mark in served Geist. Editing preserves grapheme navigation and copying retains the source text.

For the legacy API comparison, start the API with `NODE_ENV=development AIRDESIGN_COMPARE_FONT_LAYOUT=1`. Look for `Served font comparison` in the API console. Each adapter samples up to 512 UTF-16 units and 64 candidate shapes at a time, at least 250 ms apart.

The shipped ICU module keeps grapheme and line rules and the Thai, Lao, Khmer, and Burmese dictionaries. Its budgets are 2.7 MB raw and 1.2 MB gzip. The browser spec verifies the WASM hash and compares its break offsets with the pinned ICU reference and the Unicode suites. The build copies the licence notices beside the browser assets.

To rebuild the ICU module, activate Emscripten 4.0.23 and check out ICU at `release-77-1`. Run `bash packages/fonts/wasm/build-icu.sh <icu-checkout> <empty-build-directory>` from the repo root.

Each Node process or browser JavaScript context shares one engine with a 48 MiB font byte budget. Visible surfaces pin the files their text needs. The budget can grow to 128 MiB to hold pinned files. Export and the visible slide can displace filmstrip faces. If the selected slides exceed the hard cap, export asks you to choose fewer slides or use fewer fonts. HarfBuzz keeps font files by revision and SHA-256. Face reads run concurrently and share a read in flight for the same revision and key. After three failures, a face can be read again 60 seconds after the last failure. The binding patch releases font instances, faces, and blobs so WASM can reuse their space.

For ASCII ellipses after a space, shared wrapping follows ICU's infix-punctuation rule. In a narrow `MMMM ... WWW` line, ICU keeps the ellipsis with the preceding word, while Chromium can break before the ellipsis. The differential pins both sets of line ends.

Deck language inference uses Unicode 16.0.0 Unihan. Traditional Chinese inference considers ideographs with a `kSimplifiedVariant` different from themselves and no `kTraditionalVariant` entry. The set excludes the main and auxiliary Japanese exemplars from [Unicode CLDR 47](https://github.com/unicode-org/cldr/blob/release-47/common/main/ja.xml). Shared Han characters follow the deck language, with Simplified Chinese as the automatic fallback when the deck has no language evidence. The Unicode data notice ships with the [ICU license](../../../packages/fonts/licenses/ICU.txt).
