# @airdesign/ui

AirDesign UI kit: accessible React components, a single-colour icon set and design tokens. No runtime dependencies; `react` 19 is a peer.

## Add it to an app

Pick one:

```sh
# from this repo, as a git dependency
npm i github:quanvu309/AirDesign
# or build a tarball and install it
npm pack && npm i ./airdesign-ui-0.1.0.tgz
# or in a monorepo: copy this folder to packages/ui and use a workspace dependency
```

```tsx
import "@airdesign/ui/styles.css"; // tokens + kit styles, once, at the app root
import "@airdesign/ui/base.css";   // minimal reset; skip if your app already has a preflight (Tailwind)
import { Button, IconButton, Input, Tabs, Dialog } from "@airdesign/ui";

<Button variant="primary" iconStart="plus">New file</Button>
<IconButton icon="trash" label="Delete" variant="danger" />
<Input label="Name" labelHidden={false} hint="Shown in the file list" />
```

Verified: the packed tarball installs into a clean app, type-checks under `moduleResolution: Bundler` with `skipLibCheck: false`, and renders in Node.

## What is in it
| Export | Contents |
|---|---|
| `@airdesign/ui` | **Actions:** `Button`, `IconButton`, `Toolbar` (`ToolbarGroup`, `ToolbarSeparator`), `Tooltip`, `Popover`, `Menu`, `MenuItem`. **Forms:** `Input`, `SearchField`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `NumberField`, `ColorSwatch`. **Display:** `Avatar`, `Badge`, `Card`, `Divider`, `Kbd`, `Icon`. **Navigation:** `Tabs`, `Sidebar` (`SidebarSection`, `SidebarItem`), `Breadcrumbs`, `Accordion`. **Feedback:** `Alert`, `Progress`, `Spinner`, `Skeleton`, `EmptyState`. **Overlay:** `Dialog`. **Editor:** `PropertySection`, `PropertyRow`. **AI chat:** `ChatThread`, `ChatMessage`, `Suggestion`, `ChatComposer`. Also `iconData` and the `IconName` type |
| `@airdesign/ui/styles.css` | Tokens and kit styles (`tokens.css` and `kit.css` are also exported alone) |
| `@airdesign/ui/base.css` | Zero-specificity reset the kit was designed against |
| `@airdesign/ui/snapshots` | 409 static, pixel-faithful screen pieces (sidebars, toolbars, dialogs). Reference or prototyping only; they are not props-driven and are light-only (wrap in `data-theme="light"` inside a dark page) |

56 icons: 41 filled shapes traced from the design plus 15 stroke icons (check, minus, info, warning, copy, link, eye, lock, download, user, send, undo, sun, moon, chevron-up). All follow `currentColor`.

## Theming
Everything is a `--ad-*` variable. Dark mode: set `data-theme="dark"` on `<html>` or any container; override single tokens the same way. Motion tokens: 150ms for micro-interactions, 280ms for panels; `prefers-reduced-motion` turns transitions and animations off.

## Rules the kit follows
- Icon-only controls require `label`; every field requires `label`. Types enforce it.
- Components take every native prop of their root element (`onClick`, `ref`, `aria-*`, `data-*`) plus `className` and `style`.
- Native first: `Dialog` and `Popover` use `<dialog>` and the Popover API (focus trap, Escape, light dismiss), `Select`, `RadioGroup`, `Checkbox`, `Slider` and `Accordion` use native inputs and `<details>`. Keyboard and form behaviour come from the browser.
- Composite widgets with custom keys: `Tabs` and `Toolbar` have roving focus (Arrow, Home, End); `ChatComposer` sends on Enter and adds a line on Shift+Enter.
- States: hover, `:focus-visible` ring, active press, disabled, loading (`Button`), invalid (fields).

## Examples
`examples/` rebuilds the 11 AirDesign screens (Home, Getting started, slide editor, overview, Agents, Inserts, Media, Shapes, Share) from this package. See `examples/README.md`.

## Layout
```
src/
  index.ts            public API
  components/         one file per component (related parts share a file: Feedback, Chat, Sidebar, Toolbar)
  icons/              Icon.tsx and icon-data.ts (add an icon by pasting its path data)
  lib/                cx helper
  styles/             tokens.css, kit.css, base.css
  snapshots/          generated pieces by group (brand, cards, controls, dialogs, icons, navigation, panels)
scripts/              build.mjs (tsc + css), build-catalog.mjs
examples/             Vite app with mock screens
test/                 kit and snapshot tests
```

## Develop
- `npm test`: build, then run 39 checks: markup and ARIA for every component, token use, dark-theme coverage, and 11 jsdom interaction tests (Tabs and Toolbar keys, Switch, Checkbox, RadioGroup, Slider, Select, ChatComposer, Dialog, loading and disabled buttons).
- `npm run catalog`: write `catalog.html`, a live page with every kit variant and state, a dark-mode toggle, then all snapshots (not committed).
- `npm run typecheck`, `npm run build`, `npm pack`.

## History
The kit and snapshots were generated from a Lunagraph export of the AirDesign screens (removed from this repo; see commit `8fceb8c` and `99ab48c` to `ec59b20`). The design source (`AirDesign.pen`) lives in `quanvu309/airdesign-design-assets`.

## Known gaps
- Snapshots are static, light-only copies; rebuild any you need from kit parts.
- The notification bell, copy-link and main-menu icons are multi-colour and not in the kit set.
- No Storybook; the catalog page is the visual reference. Interaction tests run in jsdom, so real-browser behaviour of `Dialog`, `Popover` and the CSS (focus rings, animation) is checked by eye only.
- No date picker, combobox, table, tree, toast or virtualised list yet. For toasts use Sonner.
