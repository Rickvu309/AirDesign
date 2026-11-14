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
  add_slide: {
    working: "Adding a slide",
    done: "Added a slide",
    refused: "Couldn't add a slide",
    stopped: "Stopped adding a slide",
  },
  duplicate_slide: {
    working: "Duplicating a slide",
    done: "Duplicated a slide",
    refused: "Couldn't duplicate a slide",
    stopped: "Stopped duplicating a slide",
  },
  delete_slide: {
    working: "Deleting a slide",
    done: "Deleted a slide",
    refused: "Couldn't delete a slide",
    stopped: "Stopped deleting a slide",
  },
  set_background: {
    working: "Changing a slide's background",
    done: "Changed a slide's background",
    refused: "Couldn't change a slide's background",
    stopped: "Stopped changing a slide's background",
  },
  add_text_box: {
    working: "Adding a text box",
    done: "Added a text box",
    refused: "Couldn't add a text box",
    stopped: "Stopped adding a text box",
  },
  delete_element: {
    working: "Deleting an element",
    done: "Deleted an element",
    refused: "Couldn't delete an element",
    stopped: "Stopped deleting an element",
  },
  move_slide: {
    working: "Moving a slide",
    done: "Moved a slide",
    refused: "Couldn't move a slide",
    stopped: "Stopped moving a slide",
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
  askAira: "Ask Aira",
  newChat: "New chat",
  attach: "Attach",
  microphone: "Microphone",
  welcome: "Tell Aira what to change in this deck.",
  addToRequest: "Add to your request",
  latest: "Show latest message",
  failedTitle: "Unable to finish your request",
  failedKept: "Aira's reply didn't come through. Its changes so far are kept. Try again, or undo them.",
  failedNothing: "Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again.",
  retry: "Try again",
  offTitle: "Aira is switched off right now",
  offBody: "Asking again won't change that. You can keep editing this deck yourself.",
  malformedTitle: "Aira couldn't take this chat",
  malformedBody: "Asking again in this chat will fail the same way. Start a new chat and ask there.",
  keptNote: "Its changes so far are kept.",
  notOffered: "Aira isn't available in your country or region yet.",
  notOfferedBody: "You can keep editing this deck yourself.",
  undoRefused: "Couldn't undo. Something Aira changed was changed again after its edit.",
  chatsTitle: "Chats on this deck",
  chatsEmpty: "Your chats with Aira on this deck show here.",
} as const
