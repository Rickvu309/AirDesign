export function browserCookies(pairs) {
  return pairs.map((pair) => {
    const split = pair.indexOf("=")
    const name = pair.slice(0, split)
    return {
      name,
      value: pair.slice(split + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: name !== "airdesign.account",
      secure: true,
      sameSite: "Lax",
    }
  })
}
