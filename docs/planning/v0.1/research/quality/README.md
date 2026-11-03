# AirDesign v0.1: a defensible quality gate

Research date: 2026-11-03. **Recommendation:** define “stunning” as human-validated presentation quality protected by defect checks and blinded preference comparisons. Keep these gates separate; never let an attractive screenshot compensate for missing content. Thresholds below are proposed product policy, not experimentally validated universal constants.

## Findings

| Primary source | Evaluation and implication |
| --- | --- |
| [DOC2PPT, AAAI 2022](https://tsujuifu.github.io/pubs/aaai22_doc2ppt.pdf) | ROUGE-SL, figure sequence precision/recall/F1, text–figure relevance, layout mIoU, human evaluation. Useful for content fidelity and reconstruction, insufficient for aesthetics. |
| [PPTAgent / PPTEval, 2025](https://arxiv.org/html/2501.03936v1) | Content and design per slide, coherence per deck, rubric scores; reported human/design Spearman correlation 0.88. Separate deck coherence from slide craft. |
| [AutoPresent / SlidesBench, CVPR 2025](https://arxiv.org/html/2501.00912v1) | 585 test examples; reference matching/content/color/position; reference-free text/image/layout/color scores 0–5, plus execution success. Human/model ICC 0.738–0.853. Primarily single-slide evaluation. |
| [SlideCoder / Slide2Code, 2025](https://arxiv.org/html/2506.07964v1) | Execution, CLIP/SSIM, content/position similarity; difficulty from element count, types, coverage. Complexity measures difficulty, not goodness; image similarity suits reconstruction. |
| [PresentBench, March 2026](https://arxiv.org/abs/2603.07244) | 238 instances, averaging 54.1 binary checklist items. Supports task-specific verifiable rubrics rather than one holistic number. |
| [SlidesGen-Bench, 2026](https://slidesgenbench.yqy314.top/) | 189 document tasks; content fidelity, visual aesthetics, editability; reports human Spearman 0.71. Useful newer computational proxies, not universal aesthetic laws. |
| [Microsoft PPT-Eval, 2026](https://microsoft.github.io/ppteval/) | 120 creation/editing tasks, partial-credit rubrics and unnecessary-change penalties; reported human Kendall τb 0.77. Distinct from PPTAgent’s PPTEval. |

[LayoutDiffusion](https://openaccess.thecvf.com/content/ICCV2023/papers/Zhang_LayoutDiffusion_Improving_Graphic_Layout_Generation_by_Discrete_Diffusion_Probabilistic_Models_ICCV_2023_paper.pdf) uses alignment, overlap, mIoU and distributional FID, excluding legitimate background overlaps. [Haraguchi et al.](https://arxiv.org/html/2410.08885v1) compare alignment/overlap/whitespace heuristics with 60 human subjects: VLMs correlate with humans but miss small details. Geometry belongs in deterministic checks.

[MLLM-as-a-Judge](https://mllm-judge.github.io/) tests absolute scoring, pair comparisons and ranking; GPT-4V achieved 78% pairwise human agreement in that study. This does not transfer automatically to slides. [ChartJudgeBench, September 2026](https://arxiv.org/abs/2609.24210) finds position bias, excessive acceptance and aesthetic weaknesses. Prefer paired judgments for relative regressions; reserve anchored absolute ratings for human acceptance. Neither is an oracle.

Tools use human feedback: [Canva Craft](https://www.canva.com/newsroom/news/canva-craft/) reports over 25,000 designer/researcher pair comparisons and favors designers when automated judgments disagree. [Adobe Agentic-DRS](https://research.adobe.com/news/agentic-design-review-system-teaching-ai-to-review-graphic-designs-the-way-experts-do/) evaluates 15 attributes with exemplars and actionable feedback. These are first-party research reports, not evidence every shipping design tool has a validated quality gate.

## Task set and execution

Start with **48 private cases, six families × eight**, requesting eight-slide decks:

| Family | Example request |
| --- | --- |
| Pitch / persuasion | Explain a product to nontechnical buyers; end with a decision. |
| Data / decision | Turn supplied CSV into an executive update with labeled charts. |
| Teaching | Explain a process with a diagram and worked example. |
| Document synthesis | Turn a supplied report into a faithful research briefing. |
| Visual storytelling | Create a portfolio or campaign story using supplied photographs. |
| Editing / repair | Rebrand, shorten, or repair an existing deck; preserve specified slides. |

Within each family cross two audience contexts × two density levels × two brand styles. Include Vietnamese/long labels, dark backgrounds, image-heavy layouts, tables, and deliberate exceptions across the matrix. Use synthetic/public licensed inputs, required facts and visual claims, forbidden inventions, assets, and 10–15 binary acceptance items per case. Keep 12 cases evaluator-private; rotate quarterly. Add sourced real failures as regression cases.

Run three independent generations per case with the same pinned agent/model, budget, assets and renderer. AirDesign remains the canvas/tool provider; the eval runner invokes an external agent. Follow [T3’s local eval pattern](/Users/quanvu/tmp/refs/t3code/evals/README.md): cases as data, current tools/skills from source, `--case`, `--baseline`, `--out`, blinded artifacts and actual usage costs. Run affected cases first, then all cases before tools/skills merge.

## Scoring stack

1. **Hard validity:** every slide renders; no clipped/off-canvas text, unintended content occlusion, missing assets, forbidden brand deviations, insufficient effective image resolution, or broken exported layout. Require all mandatory content/number checks and ≥95% remaining task items. WCAG text contrast ≥4.5:1 normally, ≥3:1 for large text ([definition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)); validate backgrounds beneath glyphs. Unknown checks require review, never silent success.
2. **Layout diagnostics:** report anchor/grid residuals in slide-width units, unintended intersection area/content area, foreground union coverage, margin minima, spacing variation within groups, quadrant whitespace imbalance, title/body size ratio, distinct font sizes and palette-token deviations. Exclude backgrounds/intentional containment. Track per-slide tails and archetype distributions. Whitespace symmetry and color harmony have no universal optimum; palette distance measures consistency, not beauty. Calibrate warnings against accepted examples rather than maximize empty space or impose a universal type scale.
3. **Vision preference:** compare each generated deck with a frozen, designer-approved baseline for that request. Supply brief, full-resolution slides and ordered contact sheets. Judge hierarchy/readability, composition/spacing, typography/color, visual relevance and deck consistency. Return win/tie/loss with slide-specific evidence. Swap A/B and blind provenance; inconsistent swaps become unresolved and need human adjudication. Keep content correctness independent. See [judge protocol](judge-protocol.md).
4. **Human calibration:** bootstrap on 120 diverse deck pairs; three independent raters, including two presentation designers and one target reader. Randomize sides, allow ties, inspect full slides; rate 1–5 with anchors: 1 unusable, 3 needs editing, 4 presentation-ready, 5 exceptional. Collect comprehension of the main takeaway. Adjudicate disagreements after independent scoring. Report agreement, Krippendorff α and judge/human agreement by family. Monthly, repeat on 48 pairs plus all release disputes.

## Threshold the team holds

Before claiming the promise, humans must rate ≥80% of bootstrap candidate decks ≥4 overall, with no craft axis median below 4 and no hard defects in accepted decks. Baselines must independently meet this quality floor. This prevents “better than a bad baseline.”

Release: a case passes when ≥2/3 samples satisfy hard/content gates and receive a resolved vision win/tie. Require **≥44/48 cases**, **≥7/8 per family**, and **zero formerly passing case regressions** against the last shipped run. Across all samples, score win=1, tie=0.5, loss=0; require the 95% case-cluster bootstrap lower bound ≥0.50 against the frozen quality baseline. Failed/unresolved samples score zero pending adjudication. Improvement claims require the bound >0.50. Freeze thresholds before testing; change them only through a documented recalibration, never to unblock a failing change.

Judge eligibility: proposed ≥80% agreement on decisive human pairs and α≥0.60 among humans. Below either, use human release decisions. These are startup targets to validate; 48 cases provide limited statistical power.

## Six enabling constraints

1. Expose real rendered text bounds; reject clipping beyond a 1 CSS-pixel tolerance at 1280×720.
2. Record semantic groups and layer roles; zero unintended occlusions; explicit intentional-overlap relationships remain inspectable.
3. Resolve typography/color tokens in the model; test theme-specific minimum size and hierarchy, plus measured contrast.
4. Expose anchors, margins and spacing; initially warn when fewer than 90% of applicable anchors fall within 2 pixels of the declared grid.
5. Preserve source facts, chart units and asset provenance; require effective image pixels ≥display pixels at target export scale.
6. Capture every final slide and export; keep text/charts editable and require a pinned render/export check before acceptance.

## Budget, risks and prototype

Planning assumptions, not measured API prices: 144 decks ×8 slides =1,152 captures; at the supplied 300 ms, 345.6 seconds serial. Two judge orders ×144=288 calls; assume 16k input/500 output tokens per call: 4.608M/0.144M tokens. At illustrative $2/$10 per million: **$10.66 judging**. Generation at $0.20–$1/deck adds $28.80–$144: **$39.46–$154.66/run**. At eight workers, 120 seconds/deck and 20 seconds/judge call, budget **50–65 minutes** including rendering/overhead; measure real costs before adoption. Baseline generation and human work are extra. Human bootstrap: 12 hours; monthly: 4.8 hours at two minutes/pair/rater. Local prototype: $0 paid APIs.

Risks: judge style/self-preference and prompt injection, benchmark memorization, simplistic grid gaming, cultural/audience differences, raster beauty hiding uneditable output, and Chromium/export mismatch. Retain unusual accepted designs, injection controls, private tasks, blinded human overrides and real export captures.

Requires Node 20+ and network for first install; Linux may need Chromium system libraries. From this folder run **`bash run.sh`**. Dependencies/browser/cache/temp stay here. First clean dependency/browser install succeeded; one measured probe run took **2.886 seconds**, excluding installation, and exited 0. Screenshots and detailed bounds are in `artifacts/`; this tests defects, not stunningness.

| Slide | Overflow | Outside | Contrast failures | Overlaps | Grid aligned | Min contrast | Hard pass |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| good-editorial | 0 | 0 | 0 | 0 | 100% | 13.262 | yes |
| good-data | 0 | 0 | 0 | 0 | 100% | 11.422 | yes |
| bad-overflow | 1 | 1 | 0 | 0 | 100% | 13.262 | no |
| bad-contrast | 0 | 0 | 2 | 0 | 100% | 1.358 | no |
| bad-overlap-grid | 0 | 0 | 0 | 1 | 0% | 13.262 | no |

The fixture checker handles plain untransformed text boxes on solid backgrounds; it does not implement image/gradient contrast, semantic overlap exceptions, PowerPoint checks or the vision/human stages. `artifacts/results.json` records all five expected classifications correctly.
