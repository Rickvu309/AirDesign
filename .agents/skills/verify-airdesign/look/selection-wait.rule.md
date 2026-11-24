# Wait for the new layer when one layer was already selected

When an edit changes the selected layer, wait for that layer. A count of one can pass while the previous layer is still selected. `.agents/skills/verify-airdesign/look/states.test.mjs` fails a state that counts one canvas selection more than once, and its message names toHaveAttribute("data-selection", expectedNode).
