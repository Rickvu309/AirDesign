import type { EditRefusal } from "@airdesign/catalog"
import { limits } from "@airdesign/document"

export type EditCode = EditRefusal

const valueBytes = limits.valueBytes.toLocaleString("en-US")

export const editNext = {
  stale: "The layer changed since it was read. Use the value and version in this answer and send the change again.",
  "person-protected":
    "A person edited this layer during this run. It is closed to this run. Do not send this change again.",
  held: "Another agent is working on this layer in its turn, and nothing landed. Its turn ends when it stops or after ten minutes without a call. Change other layers, then read this one again before you change it.",
  "run-fenced":
    "This turn's run has ended on a layer this call names, or another run holds one of them, and nothing landed. Call airdesign_stop_run with the runId your edit answers carried to end the turn, then edit in a new turn.",
  limit: `The value is over ${valueBytes} bytes, or the deck is at its size, layer or slide limit. Send a shorter value, or tell the person the deck is full.`,
  dead: "The deck has no layer with this id. Check the layer id.",
  "group-box":
    "This layer is inside a group, and nothing landed. Ungroup that group first to group or delete this layer on its own, or to move a layer of a frame that sits in a group.",
  present: "This layer is already in the deck. Check the layer id.",
  kind: "A layer this call names cannot take this edit, and nothing landed. Each line below names the change, what its layer takes, and what to send instead. Fix every line, then send the whole call again.",
  locked:
    "This layer has an animation, and the exported PowerPoint file cannot lose it, so it cannot be deleted, grouped or ungrouped. Nothing landed. Leave it, or tell the person.",
  deck: "This session can reach no deck with this id. Check the deck id.",
  owner: "This deck belongs to another account. Work only on decks this account owns.",
  deleted: "This deck was deleted for good, and nothing landed. Do not send changes to it again.",
  base: "The base is missing or not a whole number. Send the revision from airdesign_read_deck as base.",
  batch: "The changes are missing or not a list of one to one hundred changes. Send one to one hundred changes.",
  payload: "The deck's next revision could not be named for storage, and nothing landed. Tell the person.",
  field:
    "A field is missing or has the wrong form. Send only the fields the input schema lists, each in its described form.",
  kept: "A layer this call names holds that field in a form AirDesign keeps exactly as the file has it, such as a custom shape, an image fill or an effect graph, and nothing landed. Leave that field, or tell the person.",
  site: "A connection names a layer that is not a shape or image on the connector's slide, sits in another group, or has no site with that number, and nothing landed. Name a shape or image of the same slide, and a site as the instructions number them: a rectangle has 0 top, 1 left, 2 bottom and 3 right.",
  "text-from":
    "A from index in this value is not one the file has, and nothing landed. Use an index listed next, or -1 for a new run.",
  indexing:
    "The deck is still being indexed by the open AirDesign editor, and nothing landed. Call airdesign_read_deck until it reports index ready, then send this call again.",
  store: "The deck could not be reached, and nothing landed. Try again later.",
} as const satisfies Record<EditCode, string>

export const editCodes = Object.keys(editNext) as EditCode[]

export const runNext = {
  ...editNext,
  stale: "The deck changed while this call ran, and nothing changed. Call this tool again.",
  "run-fenced": "This deck has no run with this id, and nothing changed. Use the runId an edit answer carried.",
  limit: "The deck is at its layer limit, so this run could not be ended, and nothing changed. Tell the person.",
} as const satisfies Record<EditCode, string>
