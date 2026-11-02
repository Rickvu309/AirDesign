# @airdesign/ui

React components generated from the Lunagraph export in `lunagraph/components/airdesign`.
409 components in 7 groups: brand, cards, controls, dialogs, icons, navigation, panels.

```tsx
import { HomeSidebar, ShareDialog } from "@airdesign/ui";
<HomeSidebar style={{ width: 240 }} />
```

Each component takes `style` and `className`. Styles are inline, no CSS or extra dependencies; `react` is a peer.

Rebuild after the Lunagraph export changes: `cd ui-pack && npm run build` (copies components into `src/`, writes the `src/index.ts` barrel, compiles to `dist/`).

Note: the export is auto-generated from screens, so many names are generic (`InterfaceIcon42`, `IconButton7`) and some labels carry demo data (for example the account name "Quan Vu (Richard)"). Rename in Lunagraph, then rebuild.
