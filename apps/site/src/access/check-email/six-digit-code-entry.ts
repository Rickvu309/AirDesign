import { clearSignInFailure, showSignInFailure } from "../sign-in-failure"
import { submitPendingCode } from "../sign-in-requests"

const codeLength = 6

export function connectSixDigitCodeEntry(entry: Element): void {
  const input = entry.querySelector("input")
  const boxes = Array.from(entry.querySelectorAll<HTMLElement>("[data-code-box]"))
  const failure = entry.parentElement?.querySelector<HTMLElement>("[data-code-error]")
  if (!input) {
    return
  }

  const render = () => {
    const code = input.value.replace(/\D/g, "").slice(0, codeLength)
    input.value = code
    const activeIndex = Math.min(code.length, codeLength - 1)
    const isFocused = document.activeElement === input
    boxes.forEach((box, index) => {
      box.textContent = code[index] ?? ""
      box.toggleAttribute("data-active", isFocused && index === activeIndex)
    })
  }

  let submitting = false
  const submitWhenComplete = async () => {
    if (failure) clearSignInFailure(failure, input)
    if (submitting || input.value.length !== codeLength) {
      return
    }
    submitting = true
    const destination = await submitPendingCode("", input.value)
    submitting = false
    if (destination !== null) {
      location.assign(destination)
      return
    }
    if (failure) showSignInFailure(failure, input)
    input.value = ""
    render()
  }

  ;["input", "focus", "blur"].forEach((eventName) => input.addEventListener(eventName, render))
  input.addEventListener("input", submitWhenComplete)
  render()
}
