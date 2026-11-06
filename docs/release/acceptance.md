# Release acceptance reference

The P09 contract is frozen before release evaluation. The source is [C04, C05, C07, C08, C14, C15, C20, C21, C22, and C24](../planning/v0.1/delivery/contract-index.json). Local replays carry the label **harness check, not a quality result**.

The public set contains 48 tasks across six families, with eight tasks per family and three samples per task. Freeze candidate and vetted baseline hashes before judging. X04 provides the human-vetted baseline and at least 12 private holdout tasks. Empty baseline hashes block acceptance.

Hard correctness, content, and editable-export failures receive zero utility. Missing samples stay in the 144-sample denominator. Judge both orders with blinded identities. Contradictory orders receive zero utility pending human resolution. Require two passing samples per task, 44 passing tasks, seven per family, and a 95 percent bootstrap lower bound of at least 0.50. Resample tasks 10,000 times with seed 20261106.

Calibrate with 120 pairs, three independent raters per pair: two designers and one target reader. Require at least 96 accepted candidates, median overall and all five craft axes at least four, zero hard defects, ordinal Krippendorff alpha at least 0.60, and judge agreement of at least 80 percent on decisive human preferences. The calibration implementation conservatively counts only unanimous decisive human preferences. Undefined reliability or agreement blocks judge eligibility. Resolve other pairs through human review.

Tool evaluation freezes 40 tasks and three trials per model. X03 requires pinned Claude and a second model, SDK-bound execution, at least 90 percent completion, all authorization and atomicity cases passing, and no newly failing baseline case. Record model first-change distributions independently from import and export budgets.

Run `npm run verify:pr-09` for deterministic local checks. Run `node bench/release/prepare-external.mjs` to prepare operator kits. An inventory validator checks evidence presence and containment. It never certifies quality or closes an external gate.
