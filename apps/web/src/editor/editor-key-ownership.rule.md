# The editor owns no key while a show covers it

Every editor key handler, Slides or Grid, window or element, asks `editorOwnsKey` before it acts, and `editorOwnsKey` answers no while the editor frame is `inert` behind a presentation. `apps/web/src/editor/editor-key-ownership.test.tsx` fails when a key reaches an editor handler while the frame is inert, and `tests/browser/grid-zoom.spec.ts` fails when Shift+0 or Shift+2 pressed during a show changes the Grid camera behind it.
