const requestKey = "airdesign.first-request"
const openingKey = "airdesign.opening-deck"

let waiting: string | undefined

function stored(key: string): string | undefined {
  try {
    const value = sessionStorage.getItem(key)
    return value === null || value === "" ? undefined : value
  } catch {
    return undefined
  }
}

function store(key: string, value: string | undefined): void {
  try {
    if (value === undefined) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    return
  }
}

export function handFirstRequest(text: string): void {
  waiting = text
  store(requestKey, text)
}

export function peekFirstRequest(): string | undefined {
  return waiting ?? stored(requestKey)
}

export function clearFirstRequest(): void {
  waiting = undefined
  store(requestKey, undefined)
}

export function noteOpeningDeck(deck: string): void {
  store(openingKey, deck)
}

export function openingDeck(): string | undefined {
  return stored(openingKey)
}

export function clearOpeningDeck(): void {
  store(openingKey, undefined)
}
