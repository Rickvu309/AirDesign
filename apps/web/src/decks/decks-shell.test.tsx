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

describe("Starred", () => {
  const withStars = (starred: { deck: string; name: string }[]) =>
    renderToStaticMarkup(
      <DecksShell active="recents" account={{ email: "person@example.com" }} onSignOut={() => {}} starred={starred}>
        <p>content</p>
      </DecksShell>,
    )

  it("lists a real account's starred decks as links that open them", () => {
    const html = withStars([{ deck: "d1", name: "Board pack" }])
    expect(html).toMatch(/<nav aria-labelledby="[^"]+"[^>]*>[^]*Starred/)
    expect(html).toMatch(/<a href="\/deck\/d1"[^>]*>[^]*Board pack/)
    expect(html).not.toContain("Star a deck to keep it here.")
  })

  it("asks a real account with no starred deck to star one", () => {
    expect(withStars([])).toContain("Star a deck to keep it here.")
  })
})
