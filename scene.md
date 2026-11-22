# Scene words

The words for AirDesign's core: the scene in `packages/document/src/scene`. One word per idea, for code, test and tool. Where a word here differs from `GLOSSARY.md`'s model words, the old word names today's model and goes when the scene replaces it.

## Shape of a deck

**scene**:
A deck as a tree of nodes, each a flat map of properties. It is the deck's truth; PowerPoint is an import and an export.
_Avoid_: document model, element tree

**node**:
One thing in the scene: a deck, slide row, slide, frame or shape, named by its `type`. A new type is added only when its behaviour cannot be a property.
_Avoid_: element, object, layer (a layer is what a person sees in the layers panel)

**frame**:
The one container. It holds nodes and may carry paint, radius, clip, a layout or a chart. A frame with no paint is what a person calls a group.
_Avoid_: group (in code), container, artboard

**shape**:
Anything drawn. Its `geometry` is a rect, ellipse, preset, path, icon or line. A text box, a picture, an icon and a connector are shapes.
_Avoid_: element, primitive, picture node, icon node

**property**:
One named value a node holds, such as `fills`, `text` or `layout`. Which properties a node type takes is `accepts`; how each is read, shown, described and exported is its entry in `props`.
_Avoid_: trait, field, attribute

## Paint and words

**paint**:
One entry of `fills` or `strokes`: solid, gradient or image. A picture is a shape whose fill is an image paint.
_Avoid_: fill kind, image node

**theme**:
The deck's colour variables, heading and body fonts, named text styles and effect styles. A property bound to a colour variable follows the theme; applying a template writes the theme.
_Avoid_: template style, palette

## Changing a scene

**write**:
The unit of change: one property of one node set to a value, or unset. The last write in server order wins for that property.
_Avoid_: row, patch, mutation

**edit**:
Writes that land together or not at all, with a `once` key and an author.
_Avoid_: batch, transaction, change

**base**:
The revision of a property its writer read. A write to text, notes or a list whose base is behind is refused `stale`.
_Avoid_: readAt, version

**layout**:
How a frame places its children: none, row, column or grid. Laid-out boxes are computed from the scene, never written.
_Avoid_: flow, auto layout (in code)

**fold**:
The scene after every landed edit is applied in server order. The server stores it beside the log of landed edits; a tab keeps its own copy and brings it forward by catch-up.
_Avoid_: snapshot, state

**pending**:
The edits a tab has made that the server has not landed yet. What a person sees is the fold with the pending edits applied on top, so a local edit paints at once.
_Avoid_: unsent, optimistic

**catch-up**:
Asking the server for the landed edits after a revision and applying each to the tab's fold.
_Avoid_: poll, pull

## The agent's words

**agent change**:
One instruction an agent sends: `add`, `set`, `move`, `wrap`, `unwrap`, `delete` or `slide`. `compileAgentChange` turns it into writes, or refuses it by name; `compileAgentEdit` turns a batch of them into one edit of the agent's run. Nothing else turns agent words into writes.
_Avoid_: command, patch, tool call

**look**:
The choices an agent names for a layer: a theme colour, a text style name, an effect style name, a radius, words as markdown. It never names a gradient, a filter, a preset or a size.
_Avoid_: style, traits, fields

**pattern**:
An agent change that adds a frame tree of text and shapes for one idea: `kpi`, `cards`, `compare`, `matrix`, `timeline` or `flow`. A frame with `rows` is a grid of words, not a pattern. A pattern writes only the text styles the deck names and steps down to the next named size, never to one between, until its words fit.
_Avoid_: diagram, template, smart art

**free area**:
The largest clear rectangle of a slide or frame, with a gap round what is already there. An add with no `box` takes it.
_Avoid_: empty space, gap

**reading**:
What the agent saw when it last read the deck. Its text and list writes carry that revision as their `base`, so a person's later change refuses them as stale.
_Avoid_: snapshot, readAt

**run**:
One agent turn on a deck. Its first edit opens it (`phase: start`) and `stop_run` closes it. A person's change to a layer while it is open closes that layer to the run: the agent's next write to it is refused `person`.
_Avoid_: session, turn
