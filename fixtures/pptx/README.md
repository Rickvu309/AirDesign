# PowerPoint fixtures

All slide text, chart values, tables, groups, placeholders and opaque metadata in this folder are synthetic content owned by rickvu and dedicated under CC0 1.0. No third-party slide content, executable macro, images or font files are included. The fixture generator uses PptxGenJS 4.0.1 (MIT) and yazl 3.3.1 (MIT). `manifest.json` pins the committed files by SHA-256. Regeneration refreshes the manifest because library timestamps can change.

Run `node fixtures/pptx/generate.ts` from the repository root. Regenerate only deliberately; live evidence asserts the committed manifest hashes.

| File | Purpose |
| --- | --- |
| native.pptx | Two slides with styled text, shape, editable table/chart source markup and slide-specific notes |
| preservation.pptx | Native fixture plus a group, inherited master/layout placeholder and unknown namespace metadata |
| unsafe.pptx | Preservation fixture plus a metadata-URL relationship and inert macro marker for explicit removal |
| hostile-dtd.pptx | Rejected external entity declaration; never resolve it |
| hostile-font.pptx | Rejected truncated font; never send it to a font renderer |
| hostile-expansion.pptx | Two MiB zero payload compressed beyond the allowed 100:1 ratio; reject before extraction |

Aptos is a font family request, not a distributed asset or licensed reference. Font file hashes and licenses remain unresolved. The engine never substitutes fonts or claims rendering equivalence. Native labels apply to qualified text spans; opaque parts remain kept. Windows and Mac PowerPoint rendering, repair-free opening and editability are unproven until [P03R](../../docs/engineering/pptx/P03R.md).
