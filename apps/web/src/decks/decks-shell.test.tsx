import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DecksShell } from "./decks-shell"

const shell = (email: string) =>
  renderToStaticMarkup(
    <DecksShell active="recents" account={{ email }} onSignOut={() => {}}>
      <p>content</p>
    </DecksShell>,
  )

describe("account row", () => {
  it("names the account by its email once it is known", () => {
    const html = shell("person@example.com")
    expect(html).toContain(">person@example.com</span>")
    expect(html).toContain(">P</span>")
  })

  it("says Account with its own initial while the email is not known, never a blank circle", () => {
    const html = shell("")
    expect(html).toContain(">Account</span>")
    expect(html).toContain(">A</span>")
  })
})

describe("bring your own agent card", () => {
  it("links a real account to the Agents page", () => {
    const html = shell("person@example.com")
    expect(html).toContain("Bring your own agent")
    expect(html).toMatch(/<a href="\/settings\/agents"[^>]*>[^]*Connect an agent/)
  })

  it("keeps the design screen linking to its sample screen", () => {
    const html = renderToStaticMarkup(
      <DecksShell active="recents">
        <p>content</p>
      </DecksShell>,
    )
    expect(html).toContain('href="/screens/s71-01-agents-connect-approve-claude"')
  })
})
