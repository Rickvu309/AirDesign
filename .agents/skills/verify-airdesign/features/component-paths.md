# Component paths

Chart components draw filled wedges and stroked polylines. A person can pick the visible paint, and the same paths appear in the filmstrip, slide capture and PDF.

## Sub-features

- Pies and donuts use wedge paths, and line charts use paths for traces and markers. A ring's hole, a partial pie's empty sectors and a polyline's open interior stay clear.
- An agent can add a path and edit its SVG commands and fill stroke. A slide read shows the path and its box. Pass the path id as `detail` to read its SVG commands.

## How to get to it (user POV)

Open a deck with expanded chart parts. Cmd/Ctrl-click a wedge, line or marker to select it inside the chart frame. Use Export to print the slide to PDF.

## Driving it with verify-airdesign

Run journey `component-paths` after launching and checking the stack. It expands the chart fixture, compares its saved geometry, checks paint in the editor and filmstrip, captures the slide, exports a PDF and selects the painted parts. Run `path-paint` with Poppler installed for pixel checks of seams and nearly full sweeps on the canvas and in the exported PDF. Run `path-seams` for the polygon fan and mixed-opacity disc and ring checks at 1× and 2× on the canvas and in the exported PDF. The filmstrip verifies interior colours. Thumbnail resampling makes it unsuitable for seam scores. Run `line-pie-donut` for the built-in chart fixtures, their stored parts and their PDF text and paint.

## Gotchas

Path commands are relative to the layer box. Opaque wedges use a stroke in their fill colour to cover antialiasing gaps. The stroke extends one slide pixel beyond the path, including into a ring hole. Adjacent translucent wedges use vector opacity groups with the same stroke. A wedge painted on its own uses only its fill at partial opacity. A dashed trace can be picked in a dash gap.
