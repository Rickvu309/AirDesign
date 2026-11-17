# AirDesign

The words this repo uses for how a change is checked and merged. One word per idea: use the word in bold, and none of the words under Avoid.

## Language

### What runs

**check**:
One mechanical rule that passes or fails with no person and no paid model.
_Avoid_: guard, validation

**gate**:
The checks a push needs on this machine, as `pnpm gate` runs them: the cheap checks, the build of what the diff changed, and the unit and tooling tests selected from the diff. It stamps the commit. ci still runs every step.
_Avoid_: pre-push check, quick check, fast check

**step**:
One check as `pnpm check` or CI runs it, with a name and a command.
_Avoid_: task, job, stage

**part**:
A group of steps that CI runs on its own machine, beside the other parts.
_Avoid_: shard, job, matrix

**ci**:
The one result a pull request needs to merge. It passes when every part passes.
_Avoid_: pipeline, build

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
_Avoid_: validate, verify

**diff**:
The parts an exported PowerPoint file changed, added or removed against its original, with each changed XML line and its shape path. It gives no verdict; `--allow` names the parts an edit may change.
_Avoid_: delta, comparison

**slide-diff**:
The score of a painted slide against its reference image: the mean similarity, the lowest similarity of any 32 by 32 pixel tile, and the share of pixels that changed. The lowest tile catches one missing element on a mostly white slide.
_Avoid_: image diff, visual diff, screenshot comparison

**fidelity reference**:
A picture PowerPoint itself drew of a slide: a page of the PDF PowerPoint saved of a deck, or the thumbnail of slide 1 PowerPoint keeps in a deck. paint-fidelity scores our painted slides against them.
_Avoid_: golden image, ground truth

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

**grid row**:
Slides kept together in Grid, separate from PowerPoint sections. Rows are not exported.

**import**:
To make a deck from a PowerPoint file.
_Avoid_: upload, open, convert

**export**:
To save a deck as a PowerPoint or PDF file.
_Avoid_: download, save as

**present**:
To show a deck full screen, one slide at a time, to an audience. Stop presenting leaves and lands on the slide shown last.
_Avoid_: slideshow, play, run

**presenter view**:
What the person presenting sees: the current slide, the next one, the speaker notes, a timer and the slide count.
_Avoid_: speaker view, notes view

**speaker notes**:
The words a person keeps under a slide for themselves. They are shown in the presenter view and never to the audience.
_Avoid_: notes page, comments

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
The panel beside a slide that sets the selection's appearance and geometry. With no selection it sets the slide background and deck theme. Shared fields set every selected element in one undo step; the title shows their count.
_Avoid_: inspector, properties, format pane

**Mixed**:
What a design panel control shows when selected elements hold different values. Changing it gives them all one value.
_Avoid_: multiple, varies

**inherited**:
A value painted from an element's layout, master, theme or PowerPoint's default. It uses quiet ink in the design panel; a value set by a person or agent uses full ink. Reset returns the inherited value.
_Avoid_: default, placeholder value, unset

**scrub**:
Dragging a number control's name left or right to step its value. Shift steps by tens; Alt by tenths. One scrub is one undo step.
_Avoid_: slider, drag to change

**theme**:
The deck's twelve colors and heading and body fonts. Anything that names a theme color or font follows its changes, including shapes, lines, text, backgrounds and tables.
_Avoid_: palette, color scheme, template (a template is a whole design, not available yet)

**color picker**:
Where a person picks any color a field takes: a fill, line, effect, text, gradient stop, background or theme color. It shows the theme's colors by name, each with PowerPoint's lighter and darker rows (a theme tint), the RGB colors already in the deck, and a custom color set by area, hue, hex or the screen's eyedropper. A theme tint is stored as the theme color with `lumMod` and `lumOff`, so it follows a theme change. An agent sends the same colors as words, such as `accent1 lumMod 60 lumOff 40` or `#1F4E79`.
_Avoid_: palette, swatches, color menu

**table style**:
The look an imported or previously saved table takes from its deck: a header row, banded rows, borders and the text color on each, all in theme colors. The table keeps its style through import and export.
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
Two or more elements of one slide that move and resize as one. A person selects them with Shift+click or Ctrl+click (Cmd+click on a Mac) and groups them with Group or Ctrl+G; Ungroup or Ctrl+Shift+G puts each one back on the slide where it showed. An agent sends `group` or `ungroup` in its edit: `group` takes two or more element ids of one slide, `ungroup` takes one or more group ids, and nothing moves. The first click on an element of a group selects the group, the next selects that element.
_Avoid_: bundle, combine, merge, set

**selection**:
The elements a person selects on the slide or inside one group. Click selects one. Shift+click or Ctrl+click (Cmd+click on a Mac) adds or removes one. One has handles. Several have a ring each and one frame. Drag, arrows and Delete act on all as one undo step. An agent's delete drops that element from the selection.
_Avoid_: chosen, picked, active element

**connector**:
A line whose ends can attach to sites on the shapes and pictures of its slide, so it follows them while they move, resize or turn. A person drags an end onto a site, or to any other point on the slide to free it, or picks the shape and site in the design panel's Connector section; an agent sends `connection` in its `set`. A connector keeps its own line form, straight, elbow or curved, and an elbow bends where PowerPoint would bend it. None frees an end. An attached connector moves only by its ends. The code calls a connector's ends its `connection`.
_Avoid_: link, edge, arrow (an arrow is a line's end)

**site**:
A numbered point on a shape or picture where a connector's end attaches, numbered as PowerPoint numbers them: a rectangle has 0 at the top, 1 left, 2 bottom and 3 right. The design panel names a site by the side it sits on, Top, Left, Bottom or Right, or Top left and the like at a corner, and Point and its number when two sites would share a name. A shape's sites show as dots while a person drags a connector's end over it. PowerPoint calls them connection points.
_Avoid_: anchor, port, handle

**diagram**:
Shapes joined by connectors and grouped, which an agent adds in one change with `diagram`: one rounded shape per label, left to right, each joined to the next by an arrow attached to both.
_Avoid_: flowchart, SmartArt

**effects**:
An element’s shadow, glow and soft edge. The Shadow presets are Subtle, Medium and Strong; Effects keeps the exact settings. A group’s effects paint once around its contents.
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

## Model words

The words the code and the agent tools use for how a deck is stored and edited. A person never reads them. The code, the test and the tool use the same word, so one search finds all of it.

**element**:
One thing on a slide: a shape, picture, connector, group, table, chart, or a kept part of the file. The code names which one in its `kind`.
_Avoid_: object, item, widget

**node**:
Anything an edit can address that holds its own rows: an element, a slide's own node `<slide>.slide`, a slide's notes `<slide>.notes`, or the theme, `deck.theme`. An element's id, such as `258.7`, is its node. The code says `node`; the tool texts say "element id" for the same string.
_Avoid_: entity, object, item

**trait**:
A named group of fields that an element takes together: `identity`, `box`, `geometry`, `fill`, `line`, `effects`, `body`, `text`, `image`, `crop`, `connection`, `table`, `notes` and `theme`. Each kind of element takes some traits (`kindTraits`), and an agent's `set` names a trait and then its fields.
_Avoid_: property, attribute, facet, section (a section is a group of slides), group (a group is an element)

**field**:
One value of a trait, written `trait.field`, such as `box.x`, `line.width` or `text.size`. A field is the smallest thing a row sets, a reset returns to inherited, and a refusal names.
_Avoid_: property, attribute, setting

**control**:
One field in the design panel: its name, the selection's value, whether mixed or inherited, and the edit a change makes.
_Avoid_: row (a row is a stored edit), input, widget

**strip**:
Controls that share one horizontal line of a panel section, such as X and Y, or bold, italic and underline.
_Avoid_: line (a line is a trait), row, group

**alignment**:
The untitled section above the design panel title, holding align and distribute.

**panel section**:
A part of the design panel that holds the controls of one trait, Opacity or Alignment. A section may have no title.
_Avoid_: section (a section is a group of slides)

**row**:
One stored edit of one node: the format it was written in, `v`, and a `patch` of the trait fields it changes. Each field in a patch is set to a value or sent back to `inherit` or `opening`. Rows stack in order, and a node shows its rows folded field by field. A table's own rows are a kind, `row`; say table row when the two could be mixed up.
_Avoid_: edit record, change record, delta

**format**:
The one number that says which stored shape a build writes: 1 plus every stamp. A row, an index page and a command carry the format they were written in. A build refuses a stored format newer than its own, and an older tab reloads before it reads one.
_Avoid_: schema version, migration (a migration changes the API's database)

**stamp**:
A number that goes up when a stored shape changes. Each trait has one, with a hash of its fields, and the row, the index and the command have one each. The format adds them up, so raising one stamp raises the format. It is not the stamp `pnpm gate` puts on a commit.
_Avoid_: schema version, migration number

**kept**:
What the editor leaves exactly as the file has it. An element of kind `kept`, such as a diagram or an embedded object, takes only a name, alt text, hidden, a move and a delete. An element's `kept` list names design fields the editor cannot express, such as a custom shape, a picture fill or an effect graph, and a `set` on one is refused with `kept`.
_Avoid_: locked, frozen, protected, preserved

**opening**:
What a node showed when the deck was opened or the element was added: the values the file or the add gave it. A field with no row shows its opening value, and `"opening"` in a row sends a field back to it. It differs from `inherit`: the opening is what the element itself held then.
_Avoid_: original, initial, baseline, floor (the code's other word for an opening text and box)

**inherit**:
The edit that clears a node's own value so the field is inherited again. A row carries `"inherit"`, an agent's `set` sends `null`, and only fields a trait lists as `inheritable` take it. A trait's `inherits` names the rule PowerPoint inherits it by: `own` for never, `field` for each field alone, `whole` for all its fields at once, and `run` for each run of text. The design panel's Reset is the person's word for the same edit; the state it returns to is **inherited**.
_Avoid_: reset (in code and tools), unset, clear, default

**role**:
Which placeholder an element fills: `title`, `subtitle`, `body`, `date`, `footer`, `number`, `picture`, `chart`, `table` or `object`. An agent targets one with `<slide>.<role>`, or `*.<role>` for every slide.
_Avoid_: type, placeholder type

**edit**:
One call to `airdesign_edit_deck`: a deck, the revision it was read at, and up to 100 changes.
_Avoid_: batch, update, patch (a patch is the part of a row)

**change**:
One item in an edit's `changes`. Its `op` names it: `set`, `add`, `diagram`, `group` or `ungroup`. A change with no `op` sets one node's text or box.
_Avoid_: action, command (a command is what the server orders), operation

**set**:
The change that sets fields on every node its `target` names: an element id, a slide id, `<slide>.<role>`, `*.<role>` or `deck.theme`. Each field it sends becomes a row, and `null` sends it back to inherit. It lands on every node it names or on none.
_Avoid_: update, modify, write

**add**:
The change that puts a new element on one slide: a text box, or with kind `picture` an icon. Without a `box` it takes the largest free area of the slide, and its id comes back in `elements`.
_Avoid_: insert, create, new

**gesture**:
One thing a hand does in the editor, a key press or a pointer move, with its keys and where it works: Shift+click adds an element to the selection, Ctrl+G groups the selection. `gestures` in `packages/render` lists each one once, `gestureFor` tells which one a key press is, and a browser test that calls `covers` with its id proves each one.
_Avoid_: shortcut (a shortcut is a gesture's keys), hotkey, command

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

### Border

The Design panel’s none, solid, dashed and dotted presets. Line keeps exact settings.
