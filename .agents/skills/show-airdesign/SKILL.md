---
name: show-airdesign
description: "Show a person what an agent will do, how part of AirDesign works, or what a change did, as one page: a decision, an issue tree beneath it, and the evidence under each branch. Use when the owner asks to see a plan, an option to choose, how something is organized, or the result and proof of finished work, in chat or in a PR, including the annotated before and after image a visible change needs."
---

# Show AirDesign

Verify proves a change to the agent. Show makes it plain to a person, fast enough to steer. Every Show output is one page with three parts:

- **Decision.** One sentence at the top that gives the answer.
- **Issue tree.** Two to four branches beneath it, split on one axis, with no overlap and none missing.
- **Logic.** Under each branch, the reason and the evidence a reader can open.

## Pick the job

| The person asks                     | Kind      | The first split                                                                                           |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| "What will you do?" "Which option?" | `decide`  | `options`, the chosen one named in the decision                                                           |
| "How does this work?"               | `explain` | `steps` in time order, drawn as a flow; add `"loop": true` when the last step feeds the first. Or `parts` |
| "Is it done and right?"             | `assure`  | `reasons`, each resting on Verify's evidence                                                              |

## Write the tree

Write the tree as JSON, then run `logic` on it. The tool refuses a tree that breaks a rule and names the rule, the place and the fix.

```json
{
  "kind": "assure",
  "question": "Can a reviewer trust what before-after says about main?",
  "answer": {
    "claim": "Before-after no longer calls a broken base New in this PR",
    "group": { "axis": "reasons", "covers": "the fault, the new rule, and the proof" },
    "children": [
      {
        "claim": "Any base that failed to capture was labeled new",
        "evidence": [
          { "ref": ".agents/skills/verify-airdesign/look/fragment.mjs:24", "source": "Observed", "verdict": "passed" }
        ]
      },
      {
        "claim": "CI has not judged the change yet",
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

The rules it holds:

1. **One question.** `kind`, `question` and `answer` are all there.
2. **Sentence.** Every claim is a sentence of at least three words, never a topic.
3. **Shape.** A node holds children or evidence, never both. A branch holds two to four children, at most three levels below the answer.
4. **Vertical.** The first split fits the kind: `decide` by options, `explain` by steps or parts, `assure` by reasons.
5. **Horizontal.** Every split names its `axis` and what it `covers`, so a reader sees whether a branch is missing.
6. **Grounded.** Every leaf has evidence, and every `ref` opens: a repo file, a file at a line it has, or an `https` link.
7. **Source.** Each piece of evidence is `Proposal` (an idea), `Prototype` (tried under a setup) or `Observed` (the real app, the code, a check). A proposal never passes. An `assure` tree rests only on what ran, with a verdict on every piece.
8. **Weakest support.** A verdict lives on evidence only. The tool rolls it up, and each claim takes the weakest verdict beneath it. One open leaf leaves the answer open.

The tool cannot see whether a split truly has no overlap or whether a claim is true. That is your judgment: name the axis and what it covers honestly, and read every claim against its evidence before you show the page.

## When the evidence is a screen

A leaf about something a person sees rests on an image of it. Make that image with [annotate.md](annotate.md): a before and after for the PR, or callouts on one run for a bug or a proposal.

## Done when

The page answers the person's question in its decision, the tool printed a verdict, and you read the PNG as a design. Put the PNG through `verify-airdesign publish` before it goes in a PR, never a local path.
