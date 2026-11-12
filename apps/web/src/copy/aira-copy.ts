import type { AgentOp } from "@airdesign/catalog"
import type { ToolState } from "@/aira-loop"

export type StepWords = Readonly<Record<ToolState, string>>

export const airaStepWords: Readonly<Record<AgentOp, StepWords | null>> = {
  read_deck: {
    working: "Reading the deck",
    done: "Read the deck",
    refused: "Couldn't read the deck",
    stopped: "Stopped reading the deck",
  },
  edit_deck: {
    working: "Editing slides",
    done: "Edited slides",
    refused: "Couldn't edit slides",
    stopped: "Stopped editing slides",
  },
  list_decks: {
    working: "Listing your decks",
    done: "Listed your decks",
    refused: "Couldn't list your decks",
    stopped: "Stopped listing your decks",
  },
  capture_slide: {
    working: "Viewing a slide",
    done: "Viewed a slide",
    refused: "Couldn't view a slide",
    stopped: "Stopped viewing a slide",
  },
  stop_run: null,
}

export const airaOtherStepWords: StepWords = {
  working: "Working on the deck",
  done: "Worked on the deck",
  refused: "Couldn't finish a step",
  stopped: "Stopped a step",
}

export function airaStepsSummary(said: readonly string[]): string {
  const [first = "", ...rest] = said
  const lowered = rest.map((text) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`)
  return new Intl.ListFormat("en", { type: "conjunction" }).format([first, ...lowered])
}

export function airaBackOn(when: string): string {
  return `Available again ${when}`
}

export function airaLimitBodyOn(when: string): string {
  return `Your weekly usage resets ${when}. Ask again then.`
}

export function airaHistoryNameOf(title: string): string {
  return `${title}, chat history`
}

export function airaChatsKeptOf(count: number): string {
  return `This device keeps your last ${new Intl.NumberFormat("en").format(count)} chats.`
}

export const airaCopy = {
  welcome: "Aira can read this deck, rewrite its text, and move or resize what's on its slides.",
  caution: "Aira can be wrong. Check a number, a quote, or a slide before you rely on it.",
  starters: [
    "Fix the typos on every slide",
    "Make the slide titles shorter",
    "Sum up this deck in three sentences",
    "Line up the text boxes on each slide",
  ],
  addToRequest: "Add to your request",
  latest: "Show latest message",
  failedTitle: "Unable to finish your request",
  failedKept: "Aira's changes so far are kept. Ask again, or undo them.",
  failedNothing: "Nothing in your deck changed. Ask again to try once more.",
  undoRefused: "Couldn't undo. These slides changed after Aira's edit.",
  chatsTitle: "Chats on this deck",
  chatsEmpty: "Your chats with Aira on this deck show here.",
} as const
