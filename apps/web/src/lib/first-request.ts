let waiting: string | undefined

export function handFirstRequest(text: string): void {
  waiting = text
}

export function peekFirstRequest(): string | undefined {
  return waiting
}

export function clearFirstRequest(): void {
  waiting = undefined
}
