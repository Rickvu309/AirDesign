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
| `@airdesign/ui` | `Button`, `IconButton`, `Input`, `SearchField`, `Avatar`, `Badge`, `Divider`, `Tabs`, `Menu`, `MenuItem`, `Card`, `Switch`, `Dialog`, `Tooltip`, `Icon` (+ `iconData`, `IconName`) |
| `@airdesign/ui/styles.css` | Tokens and kit styles (`tokens.css` and `kit.css` are also exported alone) |
| `@airdesign/ui/base.css` | Zero-specificity reset the kit was designed against |
| `@airdesign/ui/snapshots` | 409 static, pixel-faithful screen pieces (sidebars, toolbars, dialogs). Reference or prototyping only; they are not props-driven |

## Rules the kit follows
- Icon-only controls require `label`; every field requires `label`. Types enforce it.
- Components take every native prop of their root element (`onClick`, `ref`, `aria-*`, `data-*`) plus `className` and `style`.
- Colours, radii, spacing, shadow and motion are `--ad-*` variables. Re-theme by overriding them on `:root` or any parent. Motion is 150ms micro and 280ms panel; `prefers-reduced-motion` is honoured.
- States: hover, `:focus-visible` ring, active press, disabled, loading (`Button`).
- `Dialog` uses the native `<dialog>` (focus trap, Escape, backdrop). `Tabs` has roving focus with Arrow, Home and End keys.

## Layout
```
src/
  index.ts            public API
  components/         Button, Input, Tabs, ... one file each
  icons/              Icon.tsx and icon-data.ts (add an icon by pasting its path data)
  lib/                cx helper
  styles/             tokens.css, kit.css, base.css
  snapshots/          generated pieces by group (brand, cards, controls, dialogs, icons, navigation, panels)
scripts/              build.mjs (tsc + css), build-catalog.mjs
test/                 kit and snapshot tests
```

## Develop
- `npm test`: build, then run 17 checks (all components render, ARIA and labels, token use, no stray colours in `kit.css`, prop pass-through).
- `npm run catalog`: write `catalog.html`, a live page with every kit variant and state, then all snapshots (not committed).
- `npm run typecheck`, `npm run build`, `npm pack`.

## History
The kit and snapshots were generated from a Lunagraph export of the AirDesign screens (removed from this repo; see commit `8fceb8c` and `99ab48c` to `ec59b20`). The design source (`AirDesign.pen`) lives in `quanvu309/airdesign-design-assets`.

## Known gaps
- Snapshots are static copies; rebuild any you need from kit parts.
- The notification bell, copy-link and main-menu icons are multi-colour and not in the kit icon set yet.
- No Storybook or DOM-interaction tests yet; behaviour is covered by markup and ARIA assertions only.
