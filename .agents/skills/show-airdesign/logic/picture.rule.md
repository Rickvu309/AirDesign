# A logic picture has no fault a person would see

The `logic` tool reads its own picture after it draws it and lists each fault: a photo drawn smaller than its size, a photo that did not load, text past the side of its box, a part past the picture's edge, and every finding of the `look` detectors, such as text too faint to read. A page with a fault exits 1. `tests/browser/logic-picture.spec.ts` draws a result, a decision and a flow and fails on any fault, and it checks that each fault is named.
