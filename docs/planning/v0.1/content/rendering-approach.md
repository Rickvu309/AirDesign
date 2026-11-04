# Rendering Approach

AirDesign / v0.1 / Rendering

Rendering: enabling constraints

The engine team owns how. These are the only fixed points. Anything not listed is theirs to decide.

1 One seam

render exposes three things: Slide draws a slide live, snapshot turns a slide into pixels or PDF on the server, measure reports layout. Everything behind them can change, including a move to the GPU.

2 One look everywhere

Editor, server capture and export checks draw from the same code.

3 PowerPoint is the truth

Text and layout match reference images from current PowerPoint on Windows and Mac, within the pixel threshold set by the reference suite. Kept PowerPoint items show their stored preview.

4 Native text editing

Typing in any language, spellcheck and screen readers keep working.

5 Changes in, patches out

render takes a deck once, then only change sets. Only the elements a change touches redraw.

6 Budgets

On the bench reference machine: 60 fps while panning, zooming and dragging at 300 elements. An edit drawn within 16 ms. An agent change on screen within 100 ms. A 100-slide deck with its first slide editable within 2 s. Checked in bench/ on every change.

Suggested stack, not required

Slide in the editor

React DOM with one transform for pan and zoom. If the budgets cannot be met that way: CanvasKit (Skia in WASM) or Vello, both GPU 2D renderers.

Text shaping and metrics

The browser's own text layout while the slide is DOM. A UAX 14 line-break library and fontkit for metrics where text is measured outside the page. HarfBuzz in WASM only if text moves off the DOM.

Shapes

PowerPoint preset shape definitions from the OOXML spec, turned into SVG paths.

Slide images

The slide being edited previews from its live Slide, so its preview never lags. Other previews come from snapshot on the server, cached by slide version. A Web Worker with OffscreenCanvas only once a canvas or GPU renderer exists.

Fonts for export

hb-subset to embed only the characters used, when the license allows.

Checks

odiff or pixelmatch for pixel diffs. Playwright traces with Chrome performance metrics for bench/.
