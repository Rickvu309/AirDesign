# Wait for the new layer when one layer was already selected

Use `toHaveAttribute("data-selection", expectedNode)` when an edit changes the selected layer. A count of one can pass while the previous layer is still selected. The state tests flag repeated counts of one on the canvas selection in the same state.
