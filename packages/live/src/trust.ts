import { readDeckId } from "@airdesign/catalog"
import { readSlot, writeSlot } from "./store.js"

const epochKey = "\u0002epoch"

type Mint = () => string

function trustKey(deck: string): string {
  return `${deck}\u0002trust`
}

async function currentEpoch(mint: Mint): Promise<string> {
  const stored = await readSlot(epochKey)
  if (typeof stored === "string") return stored
  const epoch = mint()
  await writeSlot(epochKey, epoch)
  return epoch
}

export async function trustDeck(deck: string, mint: Mint = crypto.randomUUID.bind(crypto)): Promise<void> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return
  try {
    await writeSlot(trustKey(parsed.deck), await currentEpoch(mint))
  } catch {
    return
  }
}

export async function isTrusted(deck: string): Promise<boolean> {
  const parsed = readDeckId(deck)
  if (!parsed.ok) return false
  try {
    const stored = await readSlot(trustKey(parsed.deck))
    return typeof stored === "string" && stored === (await readSlot(epochKey))
  } catch {
    return false
  }
}

export async function distrustDevice(mint: Mint = crypto.randomUUID.bind(crypto)): Promise<void> {
  try {
    await writeSlot(epochKey, mint())
  } catch {
    return
  }
}
