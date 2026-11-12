import { useEffect, useState, type ComponentType } from "react"
import { OAuthAuthorize } from "./connect/oauth-authorize"
import { LiveProof } from "./live-proof"
import { ThinDeck } from "./thin-deck"
import { Home, homeSection } from "./decks/home"
import { AccountPage } from "./settings/account-page"
import { AgentsPage } from "./settings/agents-page"
import { settingsPaths } from "./settings/settings-routes"
import { UsagePage } from "./settings/usage-page"

type ScreenRegistry = { screens: Record<string, ComponentType> }

const registries = import.meta.glob<ScreenRegistry>("./**/*-screens.tsx", { eager: true })

const screens = Object.assign(
  {},
  ...Object.values(registries).map((registry) => registry.screens),
) as ScreenRegistry["screens"]

const screenIndexPath = "/screens"

function ScreenIndex() {
  return (
    <main className="p-8 text-sm">
      <ul className="flex flex-col gap-2">
        {Object.keys(screens)
          .sort()
          .map((screenPath) => (
            <li key={screenPath}>
              <a className="text-foreground underline underline-offset-4" href={screenPath}>
                {screenPath}
              </a>
            </li>
          ))}
      </ul>
    </main>
  )
}

function currentPath(): string {
  return window.location.pathname.replace(/\/$/, "") || "/"
}

export default function App() {
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
  if (path === "/deck") {
    window.location.replace("/")
    return null
  }
  const deck = /^\/deck\/([A-Za-z0-9_-]{1,64})$/.exec(path)
  if (deck?.[1] !== undefined) return <ThinDeck id={deck[1]} />
  if (path === "/live-proof") {
    return <LiveProof />
  }
  if (path === "/oauth/authorize") {
    return <OAuthAuthorize />
  }
  if (path === screenIndexPath) {
    return <ScreenIndex />
  }
  const Screen = screens[path]
  if (!Screen) {
    return <main className="p-8 text-sm text-muted-foreground">Unknown screen</main>
  }
  return <Screen />
}
