import type { AgentOp, EditRefusal } from "@airdesign/catalog"
import type { ToolState } from "@/aira-loop"
import { elementCopy } from "@/copy/element-copy"

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

const oddForm = "Aira asked for this change in a form AirDesign doesn't take."
const unsaved = "AirDesign couldn't save this change. Try again."

export const airaRefusalWords: Readonly<Record<EditRefusal | "unreached", string>> = {
  stale: "You or another agent changed the deck after Aira read it.",
  "person-protected": "You edited that element while Aira was working, so Aira left it as you made it.",
  held: "Another agent is editing that element right now.",
  "run-fenced": "Another request is holding that element.",
  limit: "The deck is at its size limit, or the text is too long.",
  dead: "That element is no longer in the deck.",
  present: "That element is already in the deck.",
  "group-box": "That element is inside a group. Ungroup it to change it on its own.",
  kind: "That element can't take this change.",
  locked: elementCopy.removeRefusedBody.animated,
  deck: "Aira couldn't find this deck.",
  owner: "This deck belongs to another account.",
  deleted: "This deck was deleted.",
  base: oddForm,
  batch: oddForm,
  field: oddForm,
  "text-from": oddForm,
  site: oddForm,
  payload: unsaved,
  store: unsaved,
  kept: "AirDesign keeps that part exactly as the PowerPoint file has it.",
  indexing: "The deck was still loading. Try again in a moment.",
  unreached: "Aira lost its connection during this step. Check your connection and try again.",
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
  stepsFailedTitle: "Unable to finish every step",
  stepsFailedBody: "Aira's reply may describe changes that didn't happen. Try again, or check the slides.",
  failedKept: "Aira's reply didn't come through. Its changes so far are kept. Try again, or undo them.",
  failedNothing: "Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again.",
  retry: "Try again",
  offTitle: "Aira is switched off right now",
  offBody: "Asking again won't change that. You can keep editing this deck yourself.",
  malformedTitle: "Aira couldn't take this chat",
  malformedBody: "Asking again in this chat will fail the same way. Start a new chat and ask there.",
  malformedBlocked: "Start a new chat to ask Aira",
  keptNote: "Its changes so far are kept.",
  notOffered: "Aira isn't available in your country or region yet.",
  notOfferedBody: "You can keep editing this deck yourself.",
  undoRefused: "Couldn't undo. Something Aira changed was changed again after its edit.",
  chatsTitle: "Chats on this deck",
  chatsEmpty: "Your chats with Aira on this deck show here.",
} as const
