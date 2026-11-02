# @airdesign/ui

Two layers in one package:

1. **Kit** (hand-designed): `Button`, `IconButton`, `Input`, `SearchField`, `Avatar`, `Badge`, `Divider`, `Tabs`, `Menu`/`MenuItem`, `Card`, `Switch`, `Dialog`, `Tooltip` and an `Icon` set of 42 single-colour icons. Props-driven, accessible, themed through tokens, with hover, focus, disabled and loading states and reduced-motion support. Source: `src/kit/`.
2. **Snapshots** (generated): 409 pixel-faithful components exported from Lunagraph. Use them as design reference or for whole-screen composites until the kit covers the same ground.

```tsx
import "@airdesign/ui/tokens.css";
import "@airdesign/ui/base.css";
import "@airdesign/ui/kit.css";
import { Button, IconButton, Input, Tabs, Dialog } from "@airdesign/ui";

<Button variant="primary" iconStart="plus">New file</Button>
<IconButton icon="trash" label="Delete" variant="danger" />
<Input label="Name" labelHidden={false} hint="Shown in the file list" />
```

Kit rules: icon-only controls require a `label`; every field requires a `label`; colours, radii, spacing, shadow and motion come from `--ad-*` variables (motion: 150ms micro, 280ms panel); one icon per concept, drawn from the Lunagraph icons by `scripts/build-ui-kit-icons.mjs`.

React components generated from the Lunagraph export in `lunagraph/components/airdesign`.
409 components in 7 groups: brand, cards, controls, dialogs, icons, navigation, panels. Full list: [COMPONENTS.md](COMPONENTS.md).

```tsx
import "@airdesign/ui/tokens.css"; // design tokens (--ad-*)
import "@airdesign/ui/base.css";   // minimal reset; skip if your app has a preflight
import { HomeSidebar, SearchIcon } from "@airdesign/ui";

<HomeSidebar style={{ width: 240 }} />
<SearchIcon style={{ "--ad-icon": "tomato" } as React.CSSProperties} />
```

## What a component gives you
- **Native props:** every component takes all props of its root element (`onClick`, `ref`, `aria-*`, `data-*`, `disabled`, ...) plus `style` and `className`. Props you pass override the defaults (for example `aria-label`). React 19.
- **Tokens:** colours are `var(--ad-*, fallback)`, so the pack looks right with no CSS and can be re-themed by overriding variables. Icons use `--ad-icon`.
- **Self-contained:** inline styles, no runtime dependencies, one file per component (`src/<group>/<Name>.tsx`), tree-shakeable.
- **Neutral content:** no Figma-hosted images or links, no personal names (`Your Name`). Stock photos still hotlink Unsplash.

## Develop
- `npm run build`: regenerate `src/` from Lunagraph and compile to `dist/`.
- `npm test`: build, then check that all components render, no Figma or personal data remains, colours are tokenised, images have alt text and `props` pass through. It also prints accessibility findings (unnamed buttons).
- `npm run docs`: write `COMPONENTS.md` and `catalog.html` (a filterable visual catalog, not committed).

## Pipeline
`scripts/build-ui-pack.mjs` splits the export per component and runs `scripts/ui-pack-transforms.mjs` (tokens, prop pass-through, Figma and personal-data cleanup, alt text). Names come from `scripts/rename-components.mjs` (old to new in `lunagraph/components/airdesign/rename-map.json`). Because every improvement is a build step, a cleaned-up Lunagraph file only needs `npm run build`.

## Known gaps
- Components are still snapshots: text, labels and icons are baked in, not props. The big composites (`HomeSidebar`, `MediaSidebar`, `AgentsSidebar`) repeat their parts inline instead of using the small components. Fix this in Lunagraph by building composites from instances, then rebuild.
- 12 unnamed buttons remain (swatches and toggles); the test prints them.
- About 100 one-off colours (shadow tints and similar) are not tokenised.
