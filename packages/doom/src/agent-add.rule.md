# A text an agent adds keeps the place and width it names and grows with its words, as Figma's auto height, so its box is never smaller than its painted words; only a shape's label stays fixed to its shape

`packages/doom/src/agent-add-grow.test.ts` adds a text with a box too short for its words and fails unless it lands with `resize: "height"` and a box taller than the one the agent named
