# @airdesign/ui

React components generated from the Lunagraph export in `lunagraph/components/airdesign`.
409 components in 7 groups: brand, cards, controls, dialogs, icons, navigation, panels.

```tsx
import { HomeSidebar, ShareDialog } from "@airdesign/ui";
<HomeSidebar style={{ width: 240 }} />
```

Each component takes `style` and `className`. Styles are inline, no CSS or extra dependencies; `react` is a peer.

Layout: `src/<group>/<ComponentName>.tsx`, one file per component. Rebuild after the Lunagraph export changes: `cd ui-pack && npm run build`.

Names were cleaned with `scripts/rename-components.mjs` (old to new map in `lunagraph/components/airdesign/rename-map.json`). Icons are named by shape; a screen prefix (`Home`, `GettingStarted`, `Agents`, ...) separates look-alike variants from different screens. Some labels inside the components still carry demo data (for example the account name "Quan Vu (Richard)").
