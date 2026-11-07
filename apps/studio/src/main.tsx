import {discoveryIntent} from "./access/discovery-intent.ts"
import { createRoot } from "react-dom/client"
import { createAccessClient } from "@airdesign/access/client"
import { AccessApp, readAccessRoute } from "./access/access-app.tsx"
import { SyncFixture } from "./sync/sync-fixture.tsx"
import { RenderFixture } from "./render/render-fixture.tsx"
import "./editor/workspace.css"
import "./decks/decks.css"
import "../../../packages/ui/src/tokens/tokens.css"

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(window.location.pathname === "/sync-fixture" ? <SyncFixture /> : window.location.pathname === "/render-fixture" ? <RenderFixture /> : <AccessApp client={createAccessClient("")} route={readAccessRoute(window.location)} initialScreen="checking" initialKind={discoveryIntent(window.location)} initialIntent={window.location.pathname==="/agents/approve" ? new URLSearchParams(window.location.search).get("intent") : null} />)
}
