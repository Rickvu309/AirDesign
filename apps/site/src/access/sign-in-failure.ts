export function showSignInFailure(region: HTMLElement, field: HTMLElement, message?: string): void {
  const failure = region.querySelector("[data-failure]")
  if (message !== undefined && failure) failure.textContent = message
  failure?.removeAttribute("hidden")
  field.setAttribute("aria-invalid", "true")
  field.setAttribute("aria-describedby", region.id)
}

export function clearSignInFailure(region: HTMLElement, field: HTMLElement): void {
  region.querySelector("[data-failure]")?.setAttribute("hidden", "")
  field.removeAttribute("aria-invalid")
  field.removeAttribute("aria-describedby")
}
