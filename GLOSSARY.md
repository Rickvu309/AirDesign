# AirDesign

Use one word per idea: the bold term, never its Avoid terms.

The words for the deck model and its edits are in [doom.md](docs/words/doom.md).

The words for how a change is checked, measured, proven and named are in [check-words.md](docs/words/check-words.md).

## Product words

The words a person reads in AirDesign. Code may keep its own names; the screen uses these. Every button, title and menu item is in sentence case, except the names Trash, Aira and AirDesign. Copy speaks to the person as "you", never "we".

**deck**:
A presentation a person or agent makes in AirDesign.
_Avoid_: presentation, project, file (the PDF you get when you export a deck)

**slide**:
One page of a deck.
_Avoid_: page, frame

**layer**:
One thing on a slide: a shape, text, an image, a line or a group. The code and the agent wire still say element (`element`, `elements`, `ElementId`) until its rename lands.
_Avoid_: element, object, item

**text**:
A layer that holds only text, as a person adds it with Add text. The design panel's Text box section controls how the text sits in its shape.
_Avoid_: text box (as a layer's name)

**image**:
A paint that shows a photo or an icon. Its source, fill mode, crop and adjustments are fields of fills: `fills.source`, `fills.mode`, `fills.crop`, `fills.recolor` and `fills.blur`. A photo on a slide is a shape whose fills hold an image, and the design panel titles it Image.
_Avoid_: picture, image layer

**solid**:
A fill of one color, the fill kind beside None, Gradient and Image. Its Color row picks the color.
_Avoid_: color (as a fill kind)

**ellipse**, **star**:
The shape names Figma's shape tool uses. Other shapes use familiar names such as Chevron and Cloud. The code still says `ellipse` and `star5`.
_Avoid_: oval, five-point star

**slide group**:
Slides kept together, held by one `slideRow` node.
_Avoid_: row, section

**export**:
To save a deck as a PDF file.
_Avoid_: download, save as

**present**:
To show a deck full screen, one slide at a time, to an audience. Stop presenting leaves and lands on the slide shown last.
_Avoid_: slideshow, play, run

**presenter view**:
What the person presenting sees: the current slide, the next one, the presenter notes, a timer and the slide count.
_Avoid_: speaker view, notes view

**presenter notes**:
The words a person keeps under a slide for themselves. They are shown in the presenter view and never to the audience. The code still says notes (`notes`, `<slide>.notes`) until its rename lands.
_Avoid_: speaker notes, notes page, comments

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
The agent built into AirDesign. It reads a deck, changes what the design panel can, adds, duplicates, deletes and reorders slides, sets a slide's background, adds text, shapes, icons and grids of words, attaches connectors, and groups, ungroups, duplicates and deletes layers.
_Avoid_: the assistant, the AI

**design panel**:
The panel beside a slide that sets the selection's appearance and geometry, or with no selection the slide background and template style. Shared fields set every selected layer in one undo step; the title counts them. Multi-edit text replaces the words of several text layers in one undo step.
_Avoid_: inspector, properties, format pane

**Mixed**:
What a design panel control shows when selected layers hold different values. Changing it gives them all one value.
_Avoid_: multiple, varies

**inherited**:
A value painted from a layer's layout, master, template style or the editor's default. It uses quiet ink in the design panel; a value set by a person or agent uses full ink. Reset returns the inherited value.
_Avoid_: default, placeholder value, unset

**scrub**:
Dragging a number control's name left or right to step its value. Shift steps by tens; Alt by tenths. One scrub is one undo step.
_Avoid_: slider, drag to change

**strikethrough**:
A line through text. The code calls its run flag `strike`.

**letter spacing**:
Space between letters. The panel shows percent of the first run’s size; `letterSpacing` stores native `spc`, hundredths of a point.

**list**:
A paragraph’s one choice of No list, Bulleted list or Numbered list. The code stores `none`, `bullets` or `numbers`.
_Avoid_: bullets (as the name of the choice)

**line height**:
The distance from one line of text to the next, as a percentage of the font's default line spacing: `text.lineHeight`. A deck or an agent that still says `lineSpacing` is read as line height.
_Avoid_: line spacing

**template style**:
A slide's template colors, heading and body fonts, and text styles. See [theme](docs/words/doom.md#theme) for the values the deck holds.
_Avoid_: palette, color scheme

**template colors**:
The twelve template colors: a person reads a color word such as Black, and the code keeps the slot.
_Avoid_: theme colors, palette

**template fonts**:
The heading font and the body font of a template style, stored as `major` and `minor`.
_Avoid_: theme fonts

**color picker**:
Where a person picks any color a field takes: a fill, border, effect, text, gradient stop, background or template color. The menu is titled with that property. Template colors are shown without names; the closed row names a template color and shows a hex for any other color. Others in this deck starts with Add color, then the RGB colors already in the deck, and shows more when there are many. Add color opens a picker with a color area, hue, opacity, a hex field and the screen's eyedropper. Lighter and darker tints are in that picker under Tints, stored as the template color with `lumMod` and `lumOff`, so a tint follows a template style change. The menu keeps twelve template colors. A shape stores an added color as hex. An agent sends the same colors as words, such as `accent1 lumMod 60 lumOff 40` or `#1F4E79`.
_Avoid_: palette, swatches, color menu

**icon**:
A Lucide drawing a person or an agent adds by its name, such as rocket. It paints as a vector. The code keeps its name in `fills.source`.
_Avoid_: symbol, glyph, clip art, sticker

**recolor**:
Repainting an image in gray tones, or in two colors that replace its dark and light tones (Grayscale and Duotone in the design panel).
_Avoid_: tint, filter, colorize

**crop**:
The part of an image a layer shows, stored on the image paint as `crop`: `x`, `y`, `w` and `h`, fractions of the whole image. An agent says it as the percent cut from each side. Dragging a crop handle cuts that side and shrinks the frame by as much, so the picture keeps its scale; dragging the picture moves it in the frame.
_Avoid_: trim, clip, mask

**alt text**:
The words a screen reader reads for a layer, shown beside its name in the design panel's Name and alt text section. A layer can also be hidden on its slide there.
_Avoid_: description, caption, alternative text

**opacity**:
How solid a layer is, in percent: one value that fades its fill, border, text and image together, stored as each colour's alpha. A frame's fades it and its layers as one; the export multiplies it into each. A plain group and a slide background have none.
_Avoid_: transparency, alpha (in product copy)

**group**:
Layers of one slide that move as one: Group or Ctrl+G, an agent's `group`; Ungroup, Ctrl+Shift+G or `ungroup` leaves each where it showed. Click picks the group; double-click or Cmd/Ctrl+click picks a layer in it, which moves, resizes and turns by its place on the slide as the group's box fits its layers.
_Avoid_: bundle, combine, merge, set

**frame**:
A group with its own fill, opacity, corners, border and shadow; fill, corners and border sit on its backdrop.
_Avoid_: container

**auto layout**:
A frame's rule that lays its children out in order, in a row or column, a gap apart in its padding, by Alignment; each side hugs them or is Fixed. Shift+A wraps the selection; Remove auto layout keeps each child where it is.
_Avoid_: stack

**backdrop**:
A frame's bottom layer, a rectangle with its fill, border and corners, never selected alone. Ungroup drops it.
_Avoid_: background (slide fills)

**selection**:
The layers a person selects on a slide. Click selects one, Shift+click adds or removes, and dragging a [marquee](docs/words/select.md) selects touched layers. One has handles, several a ring inside one outline. Drag, arrows and Delete act as one undo step. An agent's delete drops that layer.
_Avoid_: chosen, picked, active element

**connector**:
A line whose ends can attach to sites on its slide's shapes and images, so it follows them as they move, resize or turn. A person drags an end onto a site, or elsewhere to free it, or picks shape and site in the Connector section; an agent sends `connection` in its `set`. It keeps its line form, straight, elbow or curved, bending where PowerPoint would. None frees an end. An attached connector moves only by its ends, its `connection` in code.
_Avoid_: link, edge, arrow (an arrow is a line's end)

**site**:
A numbered point on a shape or image where a connector's end attaches, numbered as PowerPoint does: a rectangle has 0 at the top, 1 left, 2 bottom, 3 right. The design panel names it by side or corner (Top, Top left), or Point and its number when two would share a name. Sites show as dots while a connector's end is dragged over a shape. PowerPoint says connection points.
_Avoid_: anchor, port, handle

**diagram**:
Shapes joined by connectors and grouped, which an agent adds in one change with `diagram`: one rounded shape per label, left to right, each joined to the next by an arrow attached to both.
_Avoid_: flowchart, SmartArt

**effects**:
A layer's Drop shadow, Inner shadow, glow, soft edge and blur. See [Effects](docs/words/effects.md) for slots and strengths.
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

See [Doom words](docs/words/doom.md) for the terms used in the core.

## Taste words

**taste**:
The design knowledge AirDesign gives an agent as data: its guides, styles and pieces.

**guide**:
A how-to an agent reads before it designs, such as slides, execute or charts/bar.
_Avoid_: skill, except in the MCP Skills extension and the `airdesign_read_skill` tool that serve a guide

**style**:
A named design for a whole deck with a theme and text that tells an agent how to design in it.
_Avoid_: theme preset, preset

**kit**:
The set of pieces.

**piece**:
A ready layer tree from the kit that an agent copies into a slide.
_Avoid_: kit piece, snippet

## Editor words

**border**:
The stroke around a shape or image or along a line. The Border section shows none, solid, dashed and dotted, then Color and Border width.
_Avoid_: line (as a panel section), stroke, outline

**line**:
A layer drawn as a line.

**control**:
One setting in the design panel. Its `Desc` gives its kind, unit, range and choices. The editor builds the control from the Doom property it edits.
_Avoid_: row, input, widget

**strip**:
Controls that share one horizontal line of a panel section, such as X and Y, or bold, italic and underline.
_Avoid_: line (a line is a layer), row, group

**alignment**:
The untitled section above the design panel title, holding align and distribute.

**panel section**:
A part of the design panel that holds related controls, such as those for opacity or alignment. A section may have no title.

**gesture**:
A key press or pointer move in the editor. Ctrl+G groups. The Keyboard shortcuts panel, Ctrl+Shift+?, lists key presses.
_Avoid_: shortcut (in code), hotkey, command

## Problems

What can be measured about a slide's layout and its use of the deck's style.

**problem**:
A measured layout fault or a departure from the deck's style. Doom gives it as a code and its numbers; the agent pack puts it into words with the fix.
_Avoid_: finding, issue, warning, lint, diagnostic

**overflow**:
Text that does not fit its box.
_Avoid_: clipping, cutoff

**off-slide**:
An element that lies outside the slide.
_Avoid_: out of bounds, cropped

**overlap**:
Text that crosses other text, runs under something painted over it, or runs onto a layer it does not sit inside.
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

## Link

An element’s click destination, a URL or slide. Phrase links are separate.

- **Fill mode**: how an image sits in its shape: Fill, Fit, Crop or Tile.
- **Tile scale**: the size of each repeat in Tile mode as a percentage of the original image.
