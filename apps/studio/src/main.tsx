import { createRoot } from "react-dom/client"
import { createAccessClient } from "@airdesign/access/client"
import { AccessApp, readAccessRoute } from "./access/access-app.tsx"
import "../../../packages/ui/src/tokens/tokens.css"

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(<AccessApp client={createAccessClient("")} route={readAccessRoute(window.location)} initialScreen="checking" />)
}
