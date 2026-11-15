# AirDesign

The words this repo uses for how a change is checked and merged. One word per idea: use the word in bold, and none of the words under Avoid.

## Language

### What runs

**check**:
One mechanical rule that passes or fails with no person and no paid model.
_Avoid_: guard, gate, validation

**step**:
One check as `pnpm check` or CI runs it, with a name and a command.
_Avoid_: task, job, stage

**part**:
A group of steps that CI runs on its own machine, beside the other parts.
_Avoid_: shard, job, matrix

**ci**:
The one result a pull request needs to merge. It passes when every part passes.
_Avoid_: gate, pipeline, build

**owner**:
The person who owns this repository and reads what the checks list.
_Avoid_: the organization's name, admin, maintainer

**journey**:
A scripted walk through the real app, done the way a user does it.
_Avoid_: end-to-end test, scenario, flow

### What a check says

**block**:
A step blocks when its failure fails the run.
_Avoid_: hard fail, enforce

**warn**:
A step warns when it prints its failure and the run still passes.
_Avoid_: soft fail, advisory, non-blocking

**false stop**:
A failed run on a pull request that later merged with the same content.
_Avoid_: flake, spurious failure

**red main**:
The state of `main` after ci fails on a commit that is already there.
_Avoid_: broken build, broken main

### What we measure

**metric**:
A number we want moved, printed on every run of `pnpm check`.
_Avoid_: stick, score, KPI

**goal**:
The value a counted metric should reach.
_Avoid_: target, threshold

**limit**:
The most seconds a timed step may take.
_Avoid_: budget, ceiling, threshold

**known failure**:
A test that is skipped, marked to do, expected to fail, or asserts nothing.
_Avoid_: known fault, known bug, disabled test

**the bar**:
Every goal, every limit, and every PowerPoint case and deck that is already judged.
_Avoid_: quality bar, standard, baseline

**lowers the bar**:
A pull request lowers the bar when it moves a metric away from its goal, raises a limit, or changes a judged case or deck.
_Avoid_: regresses, weakens, loosens

**changes ci**:
A pull request changes ci when it edits a file that decides what ci checks.
_Avoid_: touches infra, tooling change

### How a change is shown to work

**proof**:
What a builder shows for a change: the commands it ran and what they printed.
_Avoid_: evidence, verification, validation

**judge**:
To compare an exported PowerPoint file with its original and report every difference no edit asked for.
_Avoid_: validate, verify, diff

**planted fault**:
A break put into code on purpose, to see whether a check catches it.
_Avoid_: mutant, planted break, injected bug

### How a pull request is named

**title**:
The first line of a pull request or a commit: at most 72 characters, an imperative verb and the one outcome, with no full stop.
_Avoid_: subject, headline, summary line

**area**:
The part of AirDesign a pull request touches, named by a label the `bar` check adds from the changed paths in `scripts/areas.json`: `editor`, `aira`, `deck-home`, `sign-in`, `pptx`, `document`, `verify`, `specs` and `tooling`. A pull request may have several.
_Avoid_: component, scope, module

## Product words

The words a person reads in AirDesign. Code may keep its own names; the screen uses these. Every button, title and menu item is in sentence case, except the names Trash, PowerPoint, Aira and AirDesign. Copy speaks to the person as "you", never "we".

**deck**:
One presentation a person makes, imports or exports.
_Avoid_: presentation, project, file (a file is what a deck is imported from or exported to)

**slide**:
One page of a deck.
_Avoid_: page, frame

**import**:
To make a deck from a PowerPoint file.
_Avoid_: upload, open, convert

**export**:
To save a deck as a PowerPoint or PDF file.
_Avoid_: download, save as

**Trash**:
Where a deck goes when a person moves it out of their decks. It can be restored for 30 days. Its actions are Move to Trash, Restore and Delete for good.
_Avoid_: bin, archive, remove

**star**:
To keep a deck in the Starred list in Home's sidebar. Only the person who owns the deck sees its star. Its actions are Star and Remove star.
_Avoid_: favorite, pin, bookmark

**agent**:
Software that works on a person's decks over MCP, such as Claude or Codex. A person connects and disconnects it.
_Avoid_: bot, integration, app

**Aira**:
The agent built into AirDesign. It reads a deck, changes what a person can change in the design panel, adds, duplicates, deletes and reorders slides, sets a slide's background color, adds text boxes, icons and diagrams, groups and ungroups elements, attaches connectors and deletes elements.
_Avoid_: the assistant, the AI

**design panel**:
The panel beside the slide that sets the selected element's position, size, rotation, flips, alignment, shape, opacity, fill, line, effects, text, a picture's icon, recolor and crop, a connector's ends, and the element's name and alt text, or the slide's background color and the deck's theme when nothing is selected.
_Avoid_: inspector, properties, format pane

**inherited**:
A value an element paints with but does not set itself: it comes from the element's layout, master or theme, or from PowerPoint's own default, such as 18 pt in the theme's body font. The design panel shows it in quiet ink; a value the person or an agent sets shows in full ink, and a reset returns the field to the inherited value.
_Avoid_: default, placeholder value, unset

**theme**:
The deck's twelve colors and its heading and body fonts. Every shape, line, text, background and table that names a theme color or font follows a change to it. A person changes it in the design panel's Theme section with nothing selected; an agent sends `set` with target `deck.theme`.
_Avoid_: palette, color scheme, template (a template is a whole design, not available yet)

**color picker**:
Where a person picks any color a field takes: a fill, line, effect, text, table cell, gradient stop, background or theme color. It shows the theme's colors by name, each with PowerPoint's lighter and darker rows (a theme tint), the RGB colors already in the deck, and a custom color set by area, hue, hex or the screen's eyedropper. A theme tint is stored as the theme color with `lumMod` and `lumOff`, so it follows a theme change. An agent sends the same colors as words, such as `accent1 lumMod 60 lumOff 40` or `#1F4E79`.
_Avoid_: palette, swatches, color menu

**table style**:
The look a table takes from its deck: a header row, banded rows, borders and the text color on each, all in theme colors. A new table gets the deck's own default table style, or PowerPoint's own default, Medium Style 2 - Accent 1, when the deck has none. A table imported with its own style keeps it.
_Avoid_: table theme, table format, table preset

**icon**:
A Lucide drawing a person or an agent adds by its name, such as rocket. It paints as a vector and exports as an SVG with a PNG beside it for older PowerPoint. The code calls it an icon source of a picture's `image`.
_Avoid_: symbol, glyph, clip art, sticker

**recolor**:
Repainting a picture in gray tones, or in two colors that replace its dark and light tones (Grayscale and Duotone in the design panel).
_Avoid_: tint, filter, colorize

**crop**:
How much of a picture is cut from each side, in percent. The frame keeps its size.
_Avoid_: trim, clip, mask

**alt text**:
The words a screen reader reads for an element, shown beside its name in the design panel's Name and alt text section. An element can also be hidden on its slide there.
_Avoid_: description, caption, alternative text

**opacity**:
How solid an element is, in percent: one value that fades its fill, line, text and picture together. A group, a table and a slide's background have none. The code stores it as the alpha of each colour.
_Avoid_: transparency, alpha (in product copy)

**group**:
Two or more elements of one slide that move and resize as one. A person chooses them with Shift+click and groups them with Group or Ctrl+G; Ungroup or Ctrl+Shift+G puts each one back on the slide where it showed. An agent sends `group` or `ungroup` in its edit. The first click on an element of a group selects the group, the next selects that element.
_Avoid_: bundle, combine, merge, set

**connector**:
A line whose ends can attach to sites on the shapes and pictures of its slide, so it follows them while they move, resize or turn. A person drags an end onto a site, or to any other point on the slide to free it, or picks the shape and site in the design panel's Connector section; an agent sends `connection` in its `set`. A connector keeps its own line form, straight, elbow or curved, and an elbow bends where PowerPoint would bend it. None frees an end. An attached connector moves only by its ends. The code calls a connector's ends its `connection`.
_Avoid_: link, edge, arrow (an arrow is a line's end)

**site**:
A numbered point on a shape or picture where a connector's end attaches, numbered as PowerPoint numbers them: a rectangle has 0 at the top, 1 left, 2 bottom and 3 right. A shape's sites show as dots while a person drags a connector's end over it. PowerPoint calls them connection points.
_Avoid_: anchor, port, handle

**diagram**:
Shapes joined by connectors and grouped, which an agent adds in one change with `diagram`: one rounded shape per label, left to right, each joined to the next by an arrow attached to both.
_Avoid_: flowchart, SmartArt

**effects**:
An element's shadow, glow and soft edge, set together in the Effects section of the design panel or with `effects` in an agent's `set`. Changing one keeps the others. A group's effects paint once around everything it holds, as one shape.
_Avoid_: filters, shadow styles

**request**:
What a person asks Aira to do, and everything Aira does to answer it.
_Avoid_: run, job, prompt (a run is the code's word for it)

**step**:
One thing Aira did while it answered a request, written in the past tense when done: "Read the deck", "Edited slides". A step it could not do starts with "Couldn't".
_Avoid_: tool call, action

**usage**:
How much of the week's Aira allowance a person has spent. It resets each week.
_Avoid_: quota, tokens, limit (the limit is where usage runs out)

**credits**:
Money a person adds to reset usage before the week ends.
_Avoid_: balance, funds

**Unable to**:
How a failure's title starts: what did not happen, then the next step in the body. "Unable to load your decks. Check your connection and try again."
_Avoid_: "Failed to", "Error", "Oops", "Something went wrong"

## Findings

What a slide's data can say is wrong, or worth knowing.

**finding**:
What is wrong on a slide, or worth knowing, and what would put it right.
_Avoid_: issue, warning, lint, diagnostic

**overflow**:
Text that does not fit its box.
_Avoid_: clipping, cutoff

**off-slide**:
An element that lies outside the slide.
_Avoid_: out of bounds, cropped

**overlap**:
Text hidden by text, or by something painted over it.
_Avoid_: collision, intersection

**small text**:
Type below a readable size. The limit is 10 points on a slide 540 points tall, and it scales with the slide.
_Avoid_: tiny type, fine print

**low contrast**:
Text too close in colour to the solid colour behind it.
_Avoid_: poor contrast, illegible

**empty placeholder**:
A placeholder that shows its prompt while someone edits and nothing in a slide show.
_Avoid_: blank shape, missing text
