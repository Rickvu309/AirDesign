import type { AgentOp, EditRefusal } from "@airdesign/catalog"
import { slideListCopy } from "./slide-list-copy.ts"

export type StepWords = {
  readonly working: string
  readonly done: string
  readonly refused: string
  readonly stopped: string
}

export const airaStepWords: Readonly<Record<AgentOp, StepWords | null>> = {
  execute: {
    working: "Working on slides",
    done: "Worked on slides",
    refused: "Couldn't change slides",
    stopped: "Stopped working on slides",
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
    refused: "Unable to undo the run",
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
  "run-fenced": "Another request is holding that layer.",
  limit: "The deck is at its size limit, or the text is too long.",
  dead: "That layer is no longer in the deck.",
  present: "That layer is already in the deck.",
  kind: "That layer can't take this change.",
  "last-slide": slideListCopy.lastSlide,
  deck: "Aira couldn't find this deck.",
  owner: "This deck belongs to another account.",
  deleted: "This deck was deleted.",
  base: oddForm,
  batch: oddForm,
  field: oddForm,
  payload: unsaved,
  store: unsaved,
  fonts: "Aira couldn’t remove auto layout until the text could be measured.",
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
  welcome: "Tell Aira what to change in this deck.",
  addToRequest: "Add to your request",
  latest: "Show latest message",
  failedTitle: "Unable to finish your request",
  stepsFailedTitle: "Unable to finish every step",
  stepsFailedBody: "Aira's reply may describe changes that didn't happen. Try again, or check the slides.",
  failedKept: "Aira's reply didn't come through. Its changes so far are kept. Try again, or undo them.",
  failedNothing: "Aira's reply didn't come through. Nothing in your deck changed. Check your connection and try again.",
  retry: "Try again",
  fixFonts: "Fix fonts",
  missingFontTitle: "Some characters have no matching font",
  shapingTitle: "Auto layout is still on",
  pendingFontTitle: "A font hasn’t loaded",
  offTitle: "Aira is switched off right now",
  offBody: "Asking again won't change that. You can keep editing this deck yourself.",
  malformedTitle: "Aira couldn't take this chat",
  malformedBody: "Asking again in this chat will fail the same way. Start a new chat and ask there.",
  malformedBlocked: "Start a new chat to ask Aira",
  keptNote: "Its changes so far are kept.",
  notOffered: "Aira isn't available in your country or region yet.",
  notOfferedBody: "You can keep editing this deck yourself.",
  undoRefused: "Unable to undo. Something Aira changed was changed again after its edit.",
  undone: "Aira's changes from this request are undone.",
  keptKinds: {
    text: "a text layer",
    shape: "a shape",
    picture: "an image",
    icon: "an icon",
    connector: "a line",
    group: "a group",
    frame: "a frame",
  },
  undoFailed: "Unable to undo. Check your connection and try again.",
  unavailable: "Unavailable in your region",
  chatsTitle: "Chats on this deck",
  chatsEmpty: "Your chats with Aira on this deck show here.",
} as const

export function airaFontIssue(issue: {
  kind: "coverage" | "shaping" | "pending"
  characters: string
  layers: readonly string[]
  layerNames: readonly string[]
  shaping?: readonly string[]
}): string {
  const count = issue.layers.length
  const names =
    issue.layerNames.length === count && issue.layerNames.every((name) => name.trim() !== "")
      ? new Intl.ListFormat("en").format(issue.layerNames.map((name) => `“${name}”`))
      : count === 1
        ? "1 text layer"
        : `${new Intl.NumberFormat("en").format(count)} text layers`
  if (issue.kind === "shaping") {
    const found = issue.shaping?.length ? new Intl.ListFormat("en").format(issue.shaping) : "the text"
    return `Aira can’t measure ${found} in ${names}. None of the changes in this edit were applied. You can remove auto layout in the Design panel.`
  }
  if (issue.kind === "pending")
    return `The slide updates when the font for ${names} loads. Try again when the text updates.`
  if (count === 1 && issue.characters !== "")
    return `Aira can switch the font for “${issue.characters}” in ${names} and finish removing auto layout.`
  return `Aira can switch fonts for ${names} and finish removing auto layout.`
}

export const airaFontRequest = (layers: readonly string[], frame: string | undefined) =>
  `The Fix fonts button was clicked. Run the refused airdesign_execute script again with fonts that cover the text on ${layers.join(", ")}. Keep every other operation in the script, including removing auto layout${frame === undefined ? "" : ` from frame ${frame}`}. None of that script landed. Keep the existing edits and the text on layers you are only changing the font for.`
