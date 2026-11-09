import type { ComponentType } from "react"

type ScreenRegistry = { screens: Record<string, ComponentType> }

const registries = import.meta.glob<ScreenRegistry>("./**/*-screens.tsx", { eager: true })

const screens = Object.assign({}, ...Object.values(registries).map((registry) => registry.screens)) as ScreenRegistry["screens"]

export default function App() {
  const path = window.location.pathname.replace(/\/$/, "") || "/"
  const Screen = screens[path]
  if (!Screen) {
    return <main className="p-8 text-sm text-muted-foreground">Unknown screen</main>
  }
  return <Screen />
}
