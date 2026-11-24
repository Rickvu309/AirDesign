export type SignInMailParts = { readonly link: string; readonly code: string }

export function readSignInMail(text: string): SignInMailParts {
  const lines = text.split("\n").map((line) => line.trim())
  const codes = lines.filter((line) => /^\d{6}$/.test(line))
  const links = lines.filter((line) => line.startsWith("https://") || line.startsWith("http://"))
  const [code] = codes
  const [link] = links
  if (codes.length !== 1 || links.length !== 1 || code === undefined || link === undefined) {
    throw new Error("not one sign-in mail")
  }
  return { link, code }
}
