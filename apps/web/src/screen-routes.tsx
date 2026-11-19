import type { ComponentType } from "react"
import { NotFoundPage } from "./decks/not-found-page"

type ScreenRegistry = { screens: Record<string, ComponentType> }

const registries = import.meta.glob<ScreenRegistry>("./**/*-screens.tsx", { eager: true })

export const screens = Object.assign(
  {},
  ...Object.values(registries).map((registry) => registry.screens),
) as ScreenRegistry["screens"]

export const screenIndexPath = "/screens"

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

export default function ScreenRoute({ path }: { path: string }) {
  if (path === screenIndexPath) return <ScreenIndex />
  const Screen = screens[path]
  if (!Screen) return <NotFoundPage kind="address" />
  return <Screen />
}
