# Review proportions, alignment, and details

Use this review for reference-led layout changes and feedback about size, spacing, names, or control decoration. Run it after `look` and `compare`, before publishing annotations.

## Translate the feedback into evidence

Record each request with its reference, affected states, and the evidence that would show it is satisfied. Keep this record in the run's `proof.md`. Carry later corrections into the same record. A short correction such as "blue border" names a detail to inspect. Use the surrounding feedback to determine the requested change.

| Feedback                             | Evidence to collect                                                                                                            | Judgment the scanner cannot make                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Learn the reference's proportions    | Reference dimensions, capture viewport, sidebar share of width, row pitch, heading and control sizes, page gutters, card count | Whether the page is still too large or visually heavy                                 |
| Align the sidebar like the reference | Account avatar, search icon, navigation icons, label starts, and section headings in one overview                              | Optical alignment across different component types                                    |
| Use the signature button             | Existing component or token source, idle and hover captures, keyboard-focus capture                                            | Whether the reused decoration fits this control and density                           |
| The button border looks wrong        | Unannotated detail crop with room for the border and shadow, plus the page overview                                            | Whether a ring, inset highlight, transparent border seam, or shadow looks appropriate |
| Show a person's name                 | Visible account label, menu, accessible name, and the source of the displayed name                                             | Whether an email-derived label is the person's actual name                            |

Measure CSS geometry in CSS pixels. Record a reference image's dimensions and known scale before converting image pixels. If its scale is unknown, compare proportions and label pixel estimates as estimates. Keep the capture viewport the same before and after. The Paper-derived sizes in one change are evidence for that change, not universal AirDesign limits.

## Read the page at two scales

1. Open the whole page beside the supplied reference. Judge the sidebar, main gutter, heading, controls, list rhythm, and grid together. Name the strongest visual element. Check whether a card left unchanged now dominates the smaller layout.
2. Trace icon centers and label starts across the account row, search, navigation, and section headings. Check the intended alignment groups separately. Matching container edges does not prove matching text or icons.
3. Open unannotated detail crops at native size. Inspect the button perimeter, inset highlight, shadow, radius, and text. Preserve space around the control so an outer ring remains visible. Check idle, hover, and keyboard focus separately. An unwanted idle ring and a necessary focus indicator are different states.
4. Recheck the longest content after shrinking the layout. Include Trash notes, account names, empty states, and open menus. A compact populated grid does not prove those states fit.
5. Check the truth of visible words against the data source. An email-derived name is a fallback. State that limitation in the proof instead of claiming a stored profile name.

A zero finding count means the mechanical detectors found nothing. It does not settle the visual review. The contrast detector skips gradient backgrounds. A passing scan therefore supplies no contrast verdict for the signature gradient button. Inspect or measure that case separately and record what the measurement covers.

## Make annotations support the judgment

Keep one whole-page block for scale and hierarchy. Add a second block with the same state and a tight crop for a border or other small detail. Repeated states get distinct screenshot filenames. Use the same CSS coordinate crop on both sides, with enough surrounding space for decoration and neighboring alignment anchors.

For words, keep the default text target. For a border, control size, card edge, or alignment frame, use `"target": "element"` so the arrow stops at the element's frame. For an icon, select the icon itself. A border note whose arrow points at the button's label is misleading.

```json
[
  {
    "state": "decks-list",
    "title": "Recents proportions",
    "callouts": [
      { "at": "[data-decks-sidebar]", "target": "element", "note": "Sidebar width changes from 248px to 240px" }
    ]
  },
  {
    "state": "decks-list",
    "title": "New deck perimeter",
    "crop": "[data-decks-header]",
    "callouts": [
      {
        "at": "[data-decks-header] button",
        "target": "element",
        "note": "Inspect the idle button edge against the page background"
      }
    ]
  }
]
```

Choose a tighter box with surrounding space if the header still makes the button too small. Replace the example notes with changes verified on the captured sides. Describe what the screenshot proves. Resolve crop warnings before publishing. A target outside the crop is not an element removed from the app.

Write the design judgment separately from detector counts. Name what improved, what still looks wrong, and what the tools did not check. Publish the overview and detail evidence together.
