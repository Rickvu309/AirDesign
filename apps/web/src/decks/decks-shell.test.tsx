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
  it("names the account by the person's name, read from the email, and keeps the email as its title", () => {
    const html = shell("quan.vu@example.com")
    expect(html).toContain(">Quan Vu</span>")
    expect(html).toContain('title="quan.vu@example.com"')
    expect(html).toContain('aria-label="Quan Vu, quan.vu@example.com"')
    expect(html).toContain(">Q</span>")
  })

  it("says Account with its own initial while the email is not known, never a blank circle", () => {
    const html = shell("")
    expect(html).toContain(">Account</span>")
    expect(html).toContain(">A</span>")
  })
})

describe("bring your own agent card", () => {
  it("gives a real account a button that opens the connect dialog", () => {
    const html = shell("person@example.com")
    expect(html).toContain("Bring your own agent")
    expect(html).toMatch(/<button type="button"[^>]*>[^]*?Connect an agent<\/button>/)
    expect(html).not.toContain('href="/settings/agents"')
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
    expect(html).toMatch(/<a href="\/s\/d1"[^>]*>[^]*Board pack/)
    expect(html).not.toContain("Star a deck to keep it here.")
  })

  it("asks a real account with no starred deck to star one", () => {
    expect(withStars([])).toContain("Star a deck to keep it here.")
  })
})

describe("bring your own agent card art", () => {
  const plusTile = "left-[200px]"
  const collapse = 'aria-label="Collapse"'

  it("keeps the design screen's plus tile and minus disk", () => {
    const html = renderToStaticMarkup(
      <DecksShell active="recents">
        <p>content</p>
      </DecksShell>,
    )
    expect(html).toContain(plusTile)
    expect(html).toContain(collapse)
  })

  it("leaves the plus tile off a real account, where nothing answers it, and keeps the minus disk that collapses the card", () => {
    const html = shell("person@example.com")
    expect(html).not.toContain(plusTile)
    expect(html).toContain(collapse)
  })
})

describe("Aira", () => {
  const links = (html: string) =>
    [...html.matchAll(/<a href="([^"]+)"[^>]*>(?:(?!<\/a>).)*data-sidebar-label[^>]*>([^<]+)</g)].map((found) => [
      found[2],
      found[1],
    ])

  it("sits right under All decks and opens the Aira page for a real account", () => {
    const named = links(shell("person@example.com"))
    const at = named.findIndex(([name]) => name === "All decks")
    expect(named[at + 1]).toEqual(["Aira", "/aira"])
  })

  it("opens its design screen from a design screen, and marks the page it is on", () => {
    const html = renderToStaticMarkup(
      <DecksShell active="aira">
        <p>content</p>
      </DecksShell>,
    )
    expect(links(html)).toContainEqual(["Aira", "/screens/s35-01-decks-aira-start"])
    expect(html).toMatch(/<a href="\/screens\/s35-01-decks-aira-start"[^>]*aria-current="page"/)
  })
})
