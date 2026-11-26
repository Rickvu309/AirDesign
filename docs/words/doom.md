# Doom words

The words for AirDesign's core, Doom. One word per idea, for code, test and tool.

## Shape of a deck

**Doom**:
AirDesign's core: a deck as a tree of nodes, each a flat map of properties, changed by property writes the server orders. The editor and API use Doom to edit, paint, store and sync decks.
_Avoid_: scene, document model, element tree

**Doom v0.1**:
The first end-to-end core. A person in the editor at `/s` and an agent over MCP each make a deck of frames, shapes, text, pictures, icons, lines and charts, with undo and reload, stored as Doom decks. Out of v0.1: components and instances, variables with modes, and a style library (next). PowerPoint import and export on Doom are planned.
_Avoid_: the new editor, the rewrite

**node**:
One thing in Doom: a deck, slide row, slide, frame or shape, named by its `type`. A new type is added only when its behaviour cannot be a property.
_Avoid_: element, object, layer (a layer is what a person sees on the slide)

**frame**:
The one container. It holds nodes and may carry paint, radius, clip, a layout or a component instance. A frame with no paint is what a person calls a group.
_Avoid_: group (in code), container, artboard

**shape**:
Anything drawn. Its `geometry` is a rect, ellipse, preset, path, icon or line. A text box, a picture, an icon and a connector are shapes.
_Avoid_: element, primitive, picture node, icon node

**property**:
One named value a node holds, such as `fills`, `text` or `layout`. Which properties a node type takes is `accepts`; how each is read, shown and described is its entry in `props`.
_Avoid_: trait, field, attribute

## Paint and words

**paint**:
One entry of `fills` or `strokes`: solid, gradient or image. A picture is a shape whose fill is an image paint.
_Avoid_: fill kind, image node

**theme**:
The deck's colour variables, heading and body fonts, named text styles and effect styles. A property bound to a colour variable follows the theme; applying a template writes the theme. A new deck's text styles are the consulting type scale for 1920 by 1080, 2 px a point: big number 80, title 56, heading 40, body 32, body 2 28, caption 24 and label 24, none under 24.
_Avoid_: template style, palette

## Changing a deck

**write**:
The unit of change: one property of one node set to a value, or unset. The last write in server order wins for that property.
_Avoid_: row, patch, mutation

**edit**:
Writes that land together or not at all, with a `once` key and an author.
_Avoid_: batch, transaction, change

**base**:
The revision of a property its writer read. A write to text, notes or a list whose base is behind is refused `stale`.
_Avoid_: readAt, version

**read base**:
The deck revision an edit read. An edit with a `readBase` is refused `stale` if another edit advances the deck before it lands. When the read included pending edits, those edits must land consecutively before it can be sent.

**layout**:
How a frame places its children: none, row, column or grid. Laid-out boxes are computed from Doom's nodes, never written.
_Avoid_: flow, auto layout (in code)

**measure**:
The function that gives a text its width and height. The canvas and PDF export build it from the fonts on the page (`useDoomSlide`). The agent tools use a measure built from the same font files for layout findings (`servedFontMetrics`, handed in as `host.measure`). A delete that frees a connector end uses that measure, so the stored point is the one that was painted. `measureWith({})` is only an estimate, and a freed end that used it is exact only when the shape's place does not depend on text width.
_Avoid_: font metrics, text measurement, fallback width

**fold**:
The deck after every landed edit is applied in server order. The server stores it beside the log of landed edits; a tab keeps its own copy and brings it forward by catch-up.
_Avoid_: snapshot, state

**pending**:
The edits a tab has made that the server has not landed yet. What a person sees is the fold with the pending edits applied on top, so a local edit paints at once.
_Avoid_: unsent, optimistic

**catch-up**:
Asking the server for the landed edits after a revision and applying each to the tab's fold.
_Avoid_: poll, pull

## The agent's words

**script**:
The JavaScript an agent sends to `airdesign_execute`. It runs in a sandbox on a worker thread, calls operations such as `insert`, `update` and `get`, and everything it changes lands as one edit of the agent's run, or nothing does.
_Avoid_: program, macro, batch

**operation**:
One function a script calls: `insert`, `update`, `replace`, `copy`, `move`, `remove`, `group`, `ungroup`, `variables`, `get` or `screenshot`. Each answers at once, so a script uses the new id or the measured box in its next line.
_Avoid_: tool call, command

**agent change**:
What an operation becomes: `add`, `set`, `move`, `wrap`, `unwrap`, `delete`, `duplicate`, `deck` or `slide`. `compileAgentChange` turns it into writes, or refuses it by name; `agentEditSession` compiles a script's changes one at a time and finishes them as one edit of the agent's run. Nothing else turns agent words into writes.
_Avoid_: command, patch, tool call

**look**:
The choices an agent names for a layer: a theme colour, a text style name, an effect style name, a radius, words as markdown. It never names a gradient, a filter, a preset or a size.
_Avoid_: style, traits, fields

**grid of words**:
A frame added with `rows`, one list of cells per row. The first row is the header, number columns align right, and a final Total row is bold.

**slide start**:
A designed first state for a new slide, chosen in the New slide menu: title, title and text, grid or blank. The plain plus button adds the title-only slide start. A new deck's first slide is the title start: a title and a subtitle placeholder that an agent's first title and first heading fill.
_Avoid_: layout, template slide

**free area**:
The largest clear rectangle of a slide or frame, with a gap round what is already there. An add with no `box` takes it.
_Avoid_: empty space, gap

**reading**:
What a script saw when its call opened the deck. Its text and list writes carry that revision as their `base`, so a change another writer lands before the call does refuses them as stale.
_Avoid_: snapshot, readAt

**run**:
One agent turn on a deck, and that agent's alone. Its first edit opens it (`phase: start`), and `stop_run` or the same agent's next start closes it, so an agent has one open run per deck. Another agent's write into it or stop of it is refused `run-fenced`. A person's change to a layer while it is open closes that layer to the run: the agent's next write to it is refused `person`.
A run keeps the name its agent connected under (`Aira`, `Claude Code`) and the slide of its last write. The editor says an agent is editing while that run wrote in the last 30 seconds; the server closes a run that wrote nothing for ten minutes (`endIdleRuns`). A person's run undo carries `runUndo`, which marks the run `undone` for every device and agent; its redo clears the mark, and so does the agent's next write into the run.
_Avoid_: session, turn
