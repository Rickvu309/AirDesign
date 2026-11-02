# Examples

The 11 AirDesign screens, rebuilt from `@airdesign/ui` in a small Vite app. Use the dropdown at the top to switch screens (or open `#home`, `#start`, `#slide`, `#overview`, `#agents`, `#inserts`, `#inserts-overview`, `#media-overview`, `#media`, `#shapes`, `#share`).

```sh
npm run build          # in the repo root, once (the app links the package from ../)
cd examples && npm install && npm run dev
```

| Screen | Built with |
|---|---|
| Home, Drafts (`HomeDrafts.tsx`) | `Sidebar`, `SearchField`, `Card`, `Badge`, `Avatar`, `Button` |
| Getting started dialog | `Dialog`, `ChatComposer`, `Button` |
| Slide editor | `NavRail`, `Toolbar`, `Tabs`, `IconButton`, `Select`-style controls |
| Slides overview, Inserts + overview, Shapes tray | the same editor shell with `canvas: "overview"`, a floating inspector and a shapes tray |
| Agents panel | `ChatComposer`, `Button` rows |
| Inserts panel, Media panel (+ slide view) | list rows, colour tiles, `SearchField`, a masonry grid |
| Share | `Dialog` with `Input`, `Button`, rows and a call-to-action row |

`src/EditorApp.tsx` is one editor with a small state object (`panel`, `canvas`, `inspector`, `overlay`, `shapes`), so every editor screen is a preset of the same component. Interactive bits work: the rail switches panels, Inserts → Media opens the media panel, the shapes tool opens the tray, Share opens the dialog.

Content is generic (the account is "Ada Lovelace", the photos are tonal placeholders). Dark mode toggles from the switcher bar.

Linking note: when an app links the kit from a folder that has its own `react`, set `resolve.dedupe: ["react", "react-dom"]` (see `vite.config.ts`) or you get "Cannot read properties of null (reading 'useState')". A normal install from npm does not need this.

## Fidelity to the originals

Measured against the 11 original screenshots (1470x923, photo areas and the account name masked) after 5 rounds of compare-and-fix:

| Screen | ssim | ink-F1 |
|---|---|---|
| home | 96.9 | 84.4 |
| start | 97.6 | 87.3 |
| slide | 96.2 | 86.3 |
| overview | 98.4 | 82.0 |
| agents | 95.6 | 88.0 |
| inserts | 96.0 | 88.9 |
| inserts-overview | 98.1 | 86.6 |
| media-overview | 97.7 | 93.8 |
| media | 97.2 | 87.8 |
| shapes | 97.8 | 87.7 |
| share | 97.2 | 80.8 |

ssim is structural similarity (mean 97.1). ink-F1 is stricter: text, icons and edges must land within 2px of the original (mean 87). Open the app with `?bare` to get a 1470x923 view without the switcher bar. The remaining gap is mostly icon drawings that differ from the originals and font rasterisation.

![Home](screenshots/home.png)
![Getting started](screenshots/start.png)
![Slide editor](screenshots/slide.png)
![Overview](screenshots/overview.png)
![Agents](screenshots/agents.png)
![Inserts](screenshots/inserts.png)
![Media](screenshots/media.png)
![Shapes](screenshots/shapes.png)
![Share](screenshots/share.png)
