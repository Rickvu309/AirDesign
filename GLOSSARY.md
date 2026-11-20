# AirDesign

Use one word per idea: the bold term, never its Avoid terms.

The words for how a change is checked, measured, proven and named are in [check-words.md](check-words.md).

## Product words

The words a person reads in AirDesign. Code may keep its own names; the screen uses these. Every button, title and menu item is in sentence case, except the names Trash, PowerPoint, Aira and AirDesign. Copy speaks to the person as "you", never "we".

**deck**:
One presentation a person makes, imports or exports.
_Avoid_: presentation, project, file (a file is what a deck is imported from or exported to)

**slide**:
One page of a deck.
_Avoid_: page, frame

**layer**:
One thing on a slide: a shape, text, an image, a line, a group, a table or a chart. The code and the agent wire still say element (`element`, `elements`, `ElementId`) until its rename lands.
_Avoid_: element, object, item

**text**:
A layer that holds only text, as a person adds it with Add text. The design panel's Text box section is PowerPoint's: how text sits in its shape.
_Avoid_: text box (as a layer's name)

**image**:
A paint that shows a photo or an icon. Its source, fill mode, crop and adjustments are fields of fills: `fills.source`, `fills.mode`, `fills.crop`, `fills.recolor` and `fills.blur`. A photo on a slide is a shape whose fills hold an image, and the design panel titles it Image.
_Avoid_: picture (PowerPoint's word, used only inside `packages/pptx`), image layer

**solid**:
A fill of one color, the fill kind beside None, Gradient and Image. Its Color row picks the color.
_Avoid_: color (as a fill kind)

**ellipse**, **star**:
The shape names Figma's shape tool uses. A PowerPoint shape Figma does not have keeps its PowerPoint name, such as Chevron or Cloud. The code still says `ellipse` and `star5`.
_Avoid_: oval, five-point star

**slide group**:
Slides kept together. Grid shows one line, or several when the group is long. A PowerPoint section imports as one, and export writes them back. A saved command keeps the field `row`, so old decks read.
_Avoid_: row, section

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
What the person presenting sees: the current slide, the next one, the presenter notes, a timer and the slide count.
_Avoid_: speaker view, notes view

**presenter notes**:
The words a person keeps under a slide for themselves. They are shown in the presenter view and never to the audience, and they export as the slide's PowerPoint notes. The code still says notes (`notes`, `<slide>.notes`) until its rename lands.
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
The agent built into AirDesign. It reads a deck, changes what the design panel can, adds, duplicates, deletes and reorders slides, sets a slide's background, adds text, icons and diagrams, attaches connectors, and groups, ungroups, duplicates and deletes layers.
_Avoid_: the assistant, the AI

**design panel**:
The panel beside a slide that sets the selection's appearance and geometry, or with no selection the slide background and template style. Shared fields set every selected layer in one undo step; the title counts them. Multi-edit text replaces the words of several text layers in one undo step.
_Avoid_: inspector, properties, format pane

**Mixed**:
What a design panel control shows when selected layers hold different values. Changing it gives them all one value.
_Avoid_: multiple, varies

**inherited**:
A value painted from a layer's layout, master, template style or PowerPoint's default. It uses quiet ink in the design panel; a value set by a person or agent uses full ink. Reset returns the inherited value.
_Avoid_: default, placeholder value, unset

**scrub**:
Dragging a number control's name left or right to step its value. Shift steps by tens; Alt by tenths. One scrub is one undo step.
_Avoid_: slider, drag to change

**strikethrough**:
A line through text. The code calls its run flag `strike`; PowerPoint writes single strikethrough as `sngStrike`.

**letter spacing**:
Space between letters. The panel shows percent of the first run’s size; `letterSpacing` stores native `spc`, hundredths of a point.

**list**:
A paragraph’s one choice of No list, Bulleted list or Numbered list. The code stores `none`, `bullets` or `numbers`.
_Avoid_: bullets (as the name of the choice)

**line height**:
The distance from one line of text to the next, in percent of PowerPoint's single line: `text.lineHeight`. PowerPoint writes it as `lnSpc`. A deck or an agent that still says `lineSpacing` is read as line height.
_Avoid_: line spacing

**template style**:
The look a slide takes: its template colors, heading and body fonts and text styles. The code stores the trait `templateStyle`. `deck.templateStyles` sets every template style and `deck.templateStyleN` sets one. A slide's `templateStyle.id` chooses one. A deck or an agent that still says `theme` or `template`, or addresses `deck.theme` or `deck.templateN`, is read as this.
_Avoid_: theme, palette, color scheme

**template colors**:
The twelve template colors: a person reads a color word such as Black, and the code keeps the slot.
_Avoid_: theme colors, palette

**template fonts**:
The heading font and the body font of a template style, stored as `major` and `minor`.
_Avoid_: theme fonts

**color picker**:
Where a person picks any color a field takes: a fill, border, effect, text, gradient stop, background or template color. The menu is titled with that property. Template colors are shown without names; the closed row names a template color and shows a hex for any other color. Others in this deck starts with Add color, then the RGB colors already in the deck, and shows more when there are many. Add color opens a picker with a color area, hue, opacity, a hex field and the screen's eyedropper. PowerPoint's lighter and darker tints are in that picker under Tints, stored as the template color with `lumMod` and `lumOff`, so a tint follows a template style change. The menu keeps twelve template colors. A shape stores an added color as hex. An agent sends the same colors as words, such as `accent1 lumMod 60 lumOff 40` or `#1F4E79`.
_Avoid_: palette, swatches, color menu

**table style**:
The look an imported or previously saved table takes from its deck: a header row, banded rows, borders and the text color on each, all in template colors. The table keeps its style through import and export.
_Avoid_: table theme, table format, table preset

**icon**:
A Lucide drawing a person or an agent adds by its name, such as rocket. It paints as a vector and exports as an SVG with a PNG beside it for older PowerPoint. The code keeps its name in `fills.source`.
_Avoid_: symbol, glyph, clip art, sticker

**recolor**:
Repainting an image in gray tones, or in two colors that replace its dark and light tones (Grayscale and Duotone in the design panel).
_Avoid_: tint, filter, colorize

**crop**:
How much of an image is cut from each side, in percent. The frame keeps its size.
_Avoid_: trim, clip, mask

**alt text**:
The words a screen reader reads for a layer, shown beside its name in the design panel's Name and alt text section. A layer can also be hidden on its slide there.
_Avoid_: description, caption, alternative text

**opacity**:
How solid a layer is, in percent: one value that fades its fill, border, text and image together, stored as each colour's alpha. A frame's fades it and its layers as one; the export multiplies it into each. A plain group, a table and a slide background have none.
_Avoid_: transparency, alpha (in product copy)

**group**:
Layers of one slide that move as one: Group or Ctrl+G, an agent's `group`; Ungroup, Ctrl+Shift+G or `ungroup` leaves each where it showed. Click picks the group; double-click or Cmd/Ctrl+click picks a layer in it, which moves, resizes and turns by its place on the slide as the group's box fits its layers.
_Avoid_: bundle, combine, merge, set

**frame**:
A group with its own fill, opacity, corners, border and shadow; fill, corners and border sit on its backdrop.
_Avoid_: container

**auto layout**:
A frame's rule that lays its children out in order, in a row or column, a gap apart inside its padding, aligned across, and makes the frame hug them. Shift+A wraps the selection; Remove auto layout keeps each child where it is.
_Avoid_: stack

**backdrop**:
A frame's bottom layer, a rectangle with its fill, border and corners, never selected alone. Ungroup drops it.
_Avoid_: background (slide fills)

**selection**:
The layers a person selects on a slide. Click selects one, Shift+click adds or removes, and dragging a [marquee](select.md) selects touched layers. One has handles, several a ring inside one outline. Drag, arrows and Delete act as one undo step.
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
A layer's Drop shadow, Inner shadow, glow, soft edge and blur. See [Effects](effects.md) for slots and strengths.
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
One thing on a slide: a shape, connector, group, table, chart, or a kept part of the file. The code names which one in its `kind`. A person and an agent's tool texts read layer for it until the code's rename lands.
_Avoid_: object, item, widget

**node**:
Anything an edit can address that holds its own rows: an element, a slide's own node `<slide>.slide`, a slide's notes `<slide>.notes`, or the template styles, `deck.templateStyles`. An element's id, such as `258.7`, is its node. The code says `node`; the tool texts say "layer id" for the same string.
_Avoid_: entity, object, item

**trait**:
A named group of fields that an element takes together: `identity`, `box`, `geometry`, `fills`, `border`, `effects`, `body`, `text`, `connection`, `table`, `notes` and `templateStyle`. Each kind of element takes some traits (`kindTraits`), and an agent's `set` names a trait, then its fields.
_Avoid_: property, attribute, facet, section (a section is a group of slides), group (a group is an element)

**fills**:
A shape's or a slide background's ordered list of paints, bottom first. The code stores it as the trait `fills`, in four paint slots `p0` to `p3`, and its opacity in `fills.alpha`. An agent and the slides-mode panel set it with one paint, `fills.paint`, which fills `p0` and clears the slots above. Design mode lists every paint, top first. An older build's `fill.value` reads as that paint.
_Avoid_: fill value, background fill

**paint**:
One entry of fills: a solid colour, a gradient, a pattern, a group's fill, none, or an image. A hidden paint, `{ hidden: <paint> }`, neither paints nor exports.
_Avoid_: fill kind, layer (a layer is a thing on a slide)

**border**:
The stroke around a shape or image or along a line: its paint, width, dash, cap, join, compound strokes and arrowheads, the trait `border`. The Border section shows none, solid, dashed and dotted, then Color and Border width; design mode adds the paint as a word list, every setting, and arrowheads on an open shape. An old `line` is read as border. PowerPoint writes `a:ln`.
_Avoid_: line (as a trait or a panel section), stroke, outline

**line**:
A layer drawn as a line. Never the stroke around a shape.

**baked**:
How a layer's fills export when PowerPoint cannot hold them, such as a gradient over a photo: as one image fill on the same shape, drawn by the same fill plan the canvas paints. The layer's text, border, effects and link stay native. Until the export, the deck keeps the paints in an AirDesign extension of the shape.
_Avoid_: flattened, rasterized

**field**:
One value of a trait, written `trait.field`, such as `box.x`, `border.width` or `text.size`. A field is the smallest thing a row sets, a reset returns to inherited, and a refusal names.
_Avoid_: property, attribute, setting

**control**:
One field in the design panel: its name, the selection's value, whether mixed or inherited, and the edit a change makes.
_Avoid_: row (a row is a stored edit), input, widget

**strip**:
Controls that share one horizontal line of a panel section, such as X and Y, or bold, italic and underline.
_Avoid_: line (a line is a layer), row, group

**alignment**:
The untitled section above the design panel title, holding align and distribute.

**panel section**:
A part of the design panel that holds the controls of one trait, Opacity or Alignment. A section may have no title.
_Avoid_: section (a section is a group of slides)

**row**:
One node’s stored edit: format `v` and a `patch`. Each field is set, inherited or returned to `opening`. Rows fold field by field in order. Say table row for kind `row`.
_Avoid_: edit record, change record, delta

**format**:
The one number that says which stored shape a build writes: 1 plus every stamp. A row, an index page and a command carry the format they were written in. A build refuses a stored format newer than its own, and an older tab reloads before it reads one.
_Avoid_: schema version, migration (a migration changes the API's database)

**stamp**:
A number that goes up when a stored shape changes. Each trait has one, with a hash of its fields, and the row, the index and the command have one each. The format adds them up, so raising one stamp raises the format. It is not the stamp `pnpm gate` puts on a commit.
_Avoid_: schema version, migration number

**kept**:
What the editor leaves exactly as the file has it. A `kept` element, such as a diagram or an embedded object, takes only a name, alt text, hidden, a move and a delete. An element's `kept` list names design fields the editor cannot express, such as a custom shape, and a `set` on one is refused with `kept`.
_Avoid_: locked, frozen, protected, preserved

**opening**:
What a node showed when the deck was opened or the element was added: the values the file or the add gave it. A field with no row shows its opening value, and `"opening"` in a row sends a field back to it. It differs from `inherit`: the opening is what the element itself held then.
_Avoid_: original, initial, baseline, floor (the code's other word for an opening text and box)

**inherit**:
Clears an `inheritable` field: a row sends `"inherit"`, an agent sends `null`, the panel says Reset. The trait’s `inherits` follows PowerPoint: `own` never, `field` each field, `whole` all fields together, `run` each text run.
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
The change that sets fields on every node its `target` names: an element id, a slide id, `<slide>.<role>`, `*.<role>` or `deck.templateStyles`. Each field it sends becomes a row, and `null` sends it back to inherit. It lands on every node it names or on none.
_Avoid_: update, modify, write

**add**:
The change that puts a new element on one slide: a text layer, or with `icon` a shape whose fills hold that icon. Without a `box` it takes the largest free area of the slide, and its id comes back in `elements`.
_Avoid_: insert, create, new

**gesture**:
One thing a hand does in the editor, a key press or a pointer move, with its keys and where it works. Ctrl+G groups. The Keyboard shortcuts panel, Ctrl+Shift+?, lists them.
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

## Link

An element’s click destination, a URL or slide. Phrase links are separate.

- **Fill mode**: how an image sits in its shape: Fill, Fit, Crop or Tile.
- **Tile scale**: the size of each repeat in Tile mode as a percentage of the original image.
