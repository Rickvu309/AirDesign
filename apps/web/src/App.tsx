import { lazy, Suspense, useEffect, useState } from "react"
import { LiveProof } from "./live-proof"
import { DoomProof } from "./doom-proof"
import { OAuthAuthorize } from "./connect/oauth-authorize"
import { Home, homeSection } from "./decks/home"
import { NotFoundPage } from "./decks/not-found-page"
import { AccountPage } from "./settings/account-page"
import { AgentsPage } from "./settings/agents-page"
import { settingsPaths } from "./settings/settings-routes"
import { UsagePage } from "./settings/usage-page"

import { AccountProfile } from "./settings/account-profile"

const ScreenRoute = lazy(() => import("./screen-routes"))
const DoomEditor = lazy(() => import("./doom-editor/doom-editor").then((module) => ({ default: module.DoomEditor })))

function currentPath(): string {
  return window.location.pathname.replace(/\/$/, "") || "/"
}

function AppRoutes() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const reload = () => window.location.reload()
    window.addEventListener("popstate", reload)
    return () => window.removeEventListener("popstate", reload)
  }, [])
  function navigate(next: string) {
    window.history.pushState(null, "", next)
    setPath(next)
  }
  if (path === "/" || path === "/all" || path === "/trash")
    return <Home section={homeSection(path)} navigate={navigate} />
  if (path === settingsPaths.account) return <AccountPage navigate={navigate} />
  if (path === settingsPaths.agents) return <AgentsPage navigate={navigate} />
  if (path === settingsPaths.usage) return <UsagePage navigate={navigate} />
  const doomDeck = /^\/s(?:\/([A-Za-z0-9_-]{1,64}))?$/.exec(path)
  if (doomDeck !== null)
    return (
      <Suspense>
        <DoomEditor id={doomDeck[1] ?? null} />
      </Suspense>
    )
  if (path === "/live-proof") return <LiveProof />
  if (path === "/doom-proof") return <DoomProof />
  if (path === "/oauth/authorize") return <OAuthAuthorize />
  if (path === "/screens" || path.startsWith("/screens/"))
    return (
      <Suspense>
        <ScreenRoute path={path} />
      </Suspense>
    )
  return <NotFoundPage kind="address" />
}

export default function App() {
  const path = currentPath()
  if (path.startsWith("/screens") || path === "/live-proof" || path === "/doom-proof" || path === "/oauth/authorize")
    return <AppRoutes />
  return (
    <AccountProfile>
      <AppRoutes />
    </AccountProfile>
  )
}
