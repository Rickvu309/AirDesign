const pendingEmailKey = "airdesign.pending-sign-in-email"

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(pendingEmailKey, email)
  } catch {
    return
  }
}

export function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(pendingEmailKey)
  } catch {
    return null
  }
}

const pendingNextKey = "airdesign.pending-sign-in-next"

export function rememberPendingNext(next: string | null): void {
  try {
    if (next === null) {
      sessionStorage.removeItem(pendingNextKey)
    } else {
      sessionStorage.setItem(pendingNextKey, next)
    }
  } catch {
    return
  }
}

export function readPendingNext(): string | null {
  try {
    return sessionStorage.getItem(pendingNextKey)
  } catch {
    return null
  }
}

export function rememberNextFromSearch(search: string): void {
  rememberPendingNext(new URLSearchParams(search).get("next"))
}
