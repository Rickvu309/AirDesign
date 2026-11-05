export type PlacedNode = {
  id: string
  parentId: string | null
  text: string
}

export type PersonTouch = {
  id: string
  parentId?: string
  text?: string
}

export type RunMove = {
  id: string
  parentId: string
}

export type RunUndoCase = {
  before: PlacedNode[]
  created: PlacedNode[]
  deletedIds: string[]
  moved: RunMove[]
  personTouched: PersonTouch[]
}

export type RunUndoResult = {
  nodes: PlacedNode[]
  adopted: PlacedNode[]
}

export function undoRun(input: RunUndoCase): RunUndoResult {
  const byId = new Map<string, PlacedNode>()
  for (const node of input.before) {
    byId.set(node.id, { id: node.id, parentId: node.parentId, text: node.text })
  }
  for (const deletedId of input.deletedIds) {
    const existing = byId.get(deletedId)
    if (!existing) {
      throw new Error("deleted-id-missing-from-before")
    }
    byId.set(deletedId, existing)
  }
  for (const touch of input.personTouched) {
    const existing = byId.get(touch.id)
    if (!existing) {
      continue
    }
    byId.set(touch.id, {
      id: touch.id,
      parentId: touch.parentId ?? existing.parentId,
      text: touch.text ?? existing.text,
    })
  }
  const adopted: PlacedNode[] = []
  for (const created of input.created) {
    const touch = input.personTouched.find((item) => item.id === created.id)
    if (!touch) {
      continue
    }
    const node: PlacedNode = {
      id: created.id,
      parentId: touch.parentId ?? created.parentId,
      text: touch.text ?? created.text,
    }
    byId.set(node.id, node)
    adopted.push(node)
  }
  for (const move of input.moved) {
    const touched = input.personTouched.find((item) => item.id === move.id)
    if (touched) {
      continue
    }
    const existing = byId.get(move.id)
    if (existing) {
      const original = input.before.find((node) => node.id === move.id)
      if (original) {
        byId.set(move.id, { id: existing.id, parentId: original.parentId, text: existing.text })
      }
    }
  }
  return { nodes: [...byId.values()], adopted }
}

export function parseRunUndoCase(value: unknown): RunUndoCase {
  if (!value || typeof value !== "object") {
    throw new Error("run-undo-case")
  }
  const record = value as Record<string, unknown>
  return {
    before: parseNodes(record.before),
    created: parseNodes(record.created),
    deletedIds: parseStrings(record.deletedIds),
    moved: parseMoves(record.moved),
    personTouched: parseTouches(record.personTouched),
  }
}

function parseNodes(value: unknown): PlacedNode[] {
  if (!Array.isArray(value)) {
    throw new Error("nodes")
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("node")
    }
    const node = item as Record<string, unknown>
    if (typeof node.id !== "string" || typeof node.text !== "string" || !(typeof node.parentId === "string" || node.parentId === null)) {
      throw new Error("node")
    }
    return { id: node.id, parentId: node.parentId, text: node.text }
  })
}

function parseStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("strings")
  }
  return value as string[]
}

function parseMoves(value: unknown): RunMove[] {
  if (!Array.isArray(value)) {
    throw new Error("moves")
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("move")
    }
    const move = item as Record<string, unknown>
    if (typeof move.id !== "string" || typeof move.parentId !== "string") {
      throw new Error("move")
    }
    return { id: move.id, parentId: move.parentId }
  })
}

function parseTouches(value: unknown): PersonTouch[] {
  if (!Array.isArray(value)) {
    throw new Error("touches")
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("touch")
    }
    const touch = item as Record<string, unknown>
    if (typeof touch.id !== "string") {
      throw new Error("touch")
    }
    const parsed: PersonTouch = { id: touch.id }
    if (typeof touch.parentId === "string") {
      parsed.parentId = touch.parentId
    }
    if (typeof touch.text === "string") {
      parsed.text = touch.text
    }
    return parsed
  })
}
