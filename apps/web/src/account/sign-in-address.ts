export function signInAddress(page: { readonly pathname: string; readonly search: string }): string {
  const base = import.meta.env.VITE_SIGN_IN_URL ?? "/sign-in"
  return `${base}?next=${encodeURIComponent(`${page.pathname}${page.search}`)}`
}
