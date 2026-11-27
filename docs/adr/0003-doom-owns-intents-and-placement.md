# Doom owns one canonical intent language and slide placement

The editor and the agent changed decks in two languages. The editor wrote properties through its own actions, and the agent's script compiled shorthand calls into writes, so the two drifted: a rotated shape, an auto layout frame or a free line could come out differently depending on who moved or grouped it. Each also worked out where a layer sits on the slide in its own way.

Doom now owns both. It places a slide (`placeSlide`): every layer's position, size, rotation and corners, on the slide and in its parent frame. It also holds one `Intent` union whose ops are the script's mutation verbs: `insert`, `update`, `replace`, `copy`, `paste`, `move`, `reorder`, `remove`, `group`, `ungroup` and `variables`. One `kindFields` table says which look each kind takes, and it drives both validation and the wording of a refusal. The editor's structural actions and an agent's script both compile through these intents. Continuous canvas drags at 60 fps and live typing keep their direct, narrow writes to box, geometry and text. A group's new frame takes the place of its frontmost selected member in z-order, as in Figma.

## Considered options

- Move shorthand intent compilation out of Doom into `packages/agent` or a new `model` pack: rejected. Either keeps two change languages. In `agent` it would sit at `service`, and `packwerk.yml` would stop taste and catalog, which sit below at `model`, from using it.
- Route 60 fps drags and typing through intents: rejected. Compiling each frame adds churn and overhead where the editor and agent cannot diverge.

## Consequences

- A person and an agent get the same result on rotated shapes, auto layout frames and free lines.
- Each script operation is atomic: a refused one changes nothing, the script can catch it and go on, and it takes one batch slot.
- The editor's slide geometry narrows to mask hit-testing over `placeSlide`.
- The agent's execute operations narrow to sandbox input and output (`get` with structured nodes and the layout cache, `screenshot`, images and kit paste) and optional step summaries for Aira.
