# Shared text domain contract

One validated contract, `textDomainContract`, carries paragraph marker values for the future native paragraph field in the existing change workflow. No tool is registered here. Native activation and public aliases remain unchanged. Reliability owns integration into `packages/tools/src/catalog.ts`, `snapshots.ts` and `apps/server/src/mcp`; those files are untouched.

Minimal inputs:

```json
{"kind":"paragraph-marker","value":{"kind":"number","format":"decimal","punctuation":"plain","start":null}}
{"kind":"paragraph-marker","value":{"kind":"number","format":"alphaLower","punctuation":"right-parenthesis","start":27}}
{"kind":"paragraph-marker","value":{"kind":"source-number","scheme":"thaiAlphaPeriod","start":null}}
```

A missing punctuation field deliberately means period for old stored markers. Decimal supports plain, period, right-parenthesis and parentheses. Alphabetic and Roman support the latter three only. Alpha counters repeat letters (27 aa, 28 bb, 52 zz, 53 aaa). Counter transitions remain in the separate deck numbering transducer; presentation does not modify counter values.

Source-number is a closed DrawingML scheme enumeration, never arbitrary XML. Source scheme and start remain narrow properties in native history and projection. The source-preserving exporter retains the original buAutoNum span and surrounding dependencies when unrelated fields change. Generated serialization emits the exact scheme, never approximates it. Unavailable source numbering and Roman values above 3999 show an explicit limitation label; text stays present and editable. Alpha rendering exceeding 4096 letters also reports unavailable.

Unknown schemes, unknown fields, nonexistent combinations, fractional/nonpositive starts, and out-of-range retained source starts are rejected. Legacy supported starts retain the prior safe-integer stored contract. This module adds no tools, result payloads or SDK dependencies. Its JSON schema is tested below 8000 characters; complete server budgets remain Reliability-owned and require their integration gate.
