import type { AgentOp, EditRefusal } from "@airdesign/catalog"
import { type UndoStays, agentUndoStays } from "./agent-runs-copy.ts"
import { elementCopy } from "./element-copy.ts"
import { slideListCopy } from "./slide-list-copy.ts"

export type StepWords = {
  readonly working: string
  readonly done: string
  readonly refused: string
  readonly stopped: string
}

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
  create_deck: {
    working: "Creating a deck",
    done: "Created a deck",
    refused: "Couldn't create a deck",
    stopped: "Stopped creating a deck",
  },
  stop_run: null,
  undo_run: {
    working: "Undoing the run",
    done: "Undid the run",
    refused: "Couldn't undo the run",
    stopped: "Stopped undoing the run",
  },
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
  "person-protected": "You edited that layer while Aira was working, so Aira left it as you made it.",
  held: "Another agent is editing that layer right now.",
  "run-fenced": "Another request is holding that layer.",
  limit: "The deck is at its size limit, or the text is too long.",
  dead: "That layer is no longer in the deck.",
  present: "That layer is already in the deck.",
  "group-box": "That layer is inside a group. Ungroup it to change it on its own.",
  kind: "That layer can't take this change.",
  "last-slide": slideListCopy.lastSlide,
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
  kept: "Aira can't change that part of the deck.",
  image: "AirDesign couldn't use the image at that web address.",
  unreached: "Aira lost its connection during this step. Check your connection and try again.",
}

export function airaStepsSummary(said: readonly string[]): string {
  const [first = "", ...rest] = said
  const lowered = rest.map((text) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`)
  return new Intl.ListFormat("en", { type: "conjunction" }).format([first, ...lowered])
}

export function airaKeptLayerName(name: string): string {
  return `“${name}”`
}

export function airaUndoStays(stays: UndoStays): string {
  return agentUndoStays("Aira", stays)
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
  signIn: "Sign in",
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
  undone: "Aira's changes from this request are undone.",
  keptKinds: {
    text: "a text layer",
    shape: "a shape",
    picture: "an image",
    icon: "an icon",
    connector: "a line",
    group: "a group",
    frame: "a frame",
    chart: "a chart",
  },
  undoFailed: "Unable to undo. Check your connection and try again.",
  unavailable: "Unavailable in your region",
  chatsTitle: "Chats on this deck",
  chatsEmpty: "Your chats with Aira on this deck show here.",
} as const
