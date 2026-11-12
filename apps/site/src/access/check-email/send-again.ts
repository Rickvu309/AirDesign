import { readPendingEmail } from "../pending-sign-in-email"
import { requestSignInEmail } from "../sign-in-requests"
import { signInCopy } from "../sign-in-copy"

export function connectSendAgain(button: HTMLButtonElement, status: HTMLElement, apiBase = ""): void {
  button.addEventListener("click", async () => {
    const email = readPendingEmail()
    if (email === null || button.disabled) {
      return
    }
    button.disabled = true
    status.textContent = ""
    const sent = (await requestSignInEmail(apiBase, email)) !== null
    button.disabled = false
    status.textContent = sent ? signInCopy.sentAgain : signInCopy.emailFailed
    status.toggleAttribute("data-failed", !sent)
  })
}
