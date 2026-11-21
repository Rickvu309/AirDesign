---
name: show-airdesign
description: "Show a person what an agent will do, how part of AirDesign works, or what a change did, as one page: a decision, an issue tree beneath it, and the evidence under each branch. Use when the owner asks to see a plan, an option to choose, how something is organized, or the result and proof of finished work, in chat or in a PR, including the annotated before and after image a visible change needs."
---

# Show AirDesign

Verify proves a change to the agent. Show makes it plain to a person, fast enough to steer. Every Show output is one page with three parts:

- **Decision.** One sentence at the top that gives the answer.
- **Issue tree.** Two to four branches beneath it, split on one axis, with no overlap and none missing.
- **Logic.** Under each branch, the reason and the evidence a reader can open.

The tool writes two layers from one tree. The **picture** is for skimming: the question in one small line, the answer as the strongest box, each branch as one short claim with a small mark, and the photo itself where a claim rests on one. The **Markdown** is for reading: every claim with its detail, its evidence links and what each split covers.

## Pick the job

| The person asks                     | Kind      | The first split                                                                                           |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| "What will you do?" "Which option?" | `decide`  | `options`; mark the one you pick `"chosen": true`, and the picture greys the rest                         |
| "How does this work?"               | `explain` | `steps` in time order, drawn as a flow; add `"loop": true` when the last step feeds the first. Or `parts` |
| "Is it done and right?"             | `assure`  | `reasons`, each resting on Verify's evidence                                                              |

## Write for the person reading it

The owner skims the picture and reads the Markdown, never the code. Each node holds two layers:

- **Claim.** What is true, in one short sentence. The point comes first. It is all the picture shows, so it must stand alone.
- **Detail.** What it means for the person, or how it works, in one or two plain sentences. Add it whenever the claim alone would make the owner ask "so what?" or "how?". It goes in the Markdown only.

Write both the way the `bro` skill restates a message: plain, coherent, like one person talking to another, with no jargon. Then hold them to the `teach` skill's writing: name the thing plainly before you explain it, give the concrete mechanism instead of a label for it, keep one name per thing across the page, and keep each sentence to one or two commas.

- **Use their words.** Say what a person sees or gets: "the picture", "the slide", "the save". Leave code names, file names and flags to the evidence.
- **Read the page aloud.** If a box would make the owner ask "what does that mean?", rewrite it.

| Layer  | Instead of                                         | Write                                                          |
| ------ | -------------------------------------------------- | -------------------------------------------------------------- |
| Claim  | New only when main's state list lacks it           | New: main has never had this screen                            |
| Detail | Absent from the base registry, so the badge is set | Main's own list of screens leaves it out, so it really is new. |

## Write the tree

Write the tree as JSON, then run `logic` on it. The tool refuses a tree that breaks a rule and names the rule, the place and the fix.

```json
{
  "kind": "assure",
  "question": "Can I trust what the before and after picture says about main?",
  "answer": {
    "claim": "The picture no longer calls a screen new when main simply failed to show it",
    "group": { "axis": "reasons", "covers": "what went wrong, the new rule, and the proof" },
    "children": [
      {
        "claim": "Before, any screen main failed to show was called new",
        "detail": "The tool saw any error on main and stamped that screen as new.",
        "evidence": [
          { "ref": ".agents/skills/verify-airdesign/look/fragment.mjs:24", "source": "Observed", "verdict": "passed" }
        ]
      },
      {
        "claim": "CI has not checked the change yet",
        "evidence": [
          { "ref": "https://github.com/Rickvu309/AirDesign/pull/<n>", "source": "Observed", "verdict": "open" }
        ]
      }
    ]
  }
}
```

```sh
node .agents/skills/show-airdesign/bin/logic.mjs tree.json [--out dir]
```

It writes `tree.md` for a chat or a PR body, `tree.html`, and `tree.png` for `verify-airdesign publish`. It prints the answer's verdict.

It then reads its own picture and prints `faults`: a photo drawn smaller than its size or not loaded, text past its box, a part past the picture's edge, text too faint to read. With a fault it exits 1. Crop the photo or shorten the words, and run it again.

The rules it holds:

1. **One question.** `kind`, `question` and `answer` are all there.
2. **Sentence.** Every claim is a sentence of at least three words, never a topic.
3. **Shape.** A node holds children or evidence, never both. A branch holds two to four children, at most three levels below the answer.
4. **Vertical.** The first split fits the kind: `decide` by options, `explain` by steps or parts, `assure` by reasons. A `decide` answer marks exactly one option `"chosen": true`, and nothing else can be chosen.
5. **Horizontal.** Every split names its `axis` and what it `covers`, so a reader sees whether a branch is missing.
6. **Grounded.** Every leaf has evidence, and every `ref` opens: a repo file, a file at a line it has, or an `https` link.
7. **Source.** Each piece of evidence is `Proposal` (an idea), `Prototype` (tried under a setup) or `Observed` (the real app, the code, a check). A proposal never passes. An `assure` tree rests only on what ran, with a verdict on every piece. In the picture a box whose evidence is all `Proposal` is dashed, which means "not built yet"; `Observed` and `Prototype` draw solid.
8. **Weakest support.** A verdict lives on evidence only. The tool rolls it up, and each claim takes the weakest verdict beneath it. One open leaf leaves the answer open.
9. **Plain.** The question and each claim stay short (16 words, 22 for the answer, 14 for what a split covers, 28 for a detail) and carry no code: no backticks, file names, paths, camelCase or snake_case.

The tool cannot see whether a split truly has no overlap, whether a claim is true, or whether a plain word is still jargon to the owner. That is your judgment: name the axis and what it covers honestly, and read every claim against its evidence before you show the page.

## When the evidence is a screen

A leaf about something a person sees rests on an image of it. Make that image with [annotate.md](annotate.md): a before and after for the PR, or callouts on one run for a bug or a proposal. Put the image's path or published link in the leaf's evidence; the picture embeds the photo in that box, at a size you can read, the first time it appears. Crop it close to the part that matters; the picture draws a 2x capture at its true size, never wider than the box, and never names the file instead.

## Done when

The page answers the person's question in its decision, the tool printed a verdict and no faults, and you read the PNG as a design. Put the PNG through `verify-airdesign publish` before it goes in a PR, never a local path.
