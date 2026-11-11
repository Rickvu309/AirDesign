import type { ComponentType } from "react"
import { OAuthAuthorize } from "./connect/oauth-authorize"
import { LiveProof } from "./live-proof"
import { ThinDeck } from "./thin-deck"
import { Home } from "./decks/home"

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

export default function App() {
  const path = window.location.pathname.replace(/\/$/, "") || "/"
  if (path === "/" || path === "/trash") return <Home trash={path === "/trash"} />
  if (path === "/deck") {
    window.location.replace("/")
    return null
  }
  const deck = /^\/deck\/([A-Za-z0-9_-]{1,64})$/.exec(path)
  if (deck?.[1] !== undefined) return <ThinDeck id={deck[1]} route="deck" />
  if (path === "/live-proof") {
    return <LiveProof />
  }
  if (path === "/thin") {
    return <ThinDeck />
  }
  if (path === "/oauth/authorize") {
    return <OAuthAuthorize />
  }
  const thinDeck = /^\/thin\/([A-Za-z0-9_-]{1,64})$/.exec(path)
  if (thinDeck?.[1] !== undefined) {
    return <ThinDeck id={thinDeck[1]} />
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
