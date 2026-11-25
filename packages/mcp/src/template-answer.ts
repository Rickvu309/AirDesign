import * as doom from "@airdesign/doom"

export type WrittenTemplate = { readonly id: doom.NodeId; readonly revision: number; readonly instances: number }

export function writtenTemplates(edit: doom.Edit, after: doom.Doom): readonly WrittenTemplate[] {
  return [...new Set(edit.writes.flatMap(({ node, prop }) => (prop === "spec" ? [node] : [])))].flatMap((id) => {
    const found = doom.deckComponent(after, id)
    if (found === undefined) return []
    const instances = edit.writes.filter(
      ({ prop, value }) => prop === "instance" && (value as doom.Instance | null)?.component.node === id,
    ).length
    return [{ id, revision: found.revision, instances }]
  })
}

export const templateWords = ({ id, revision, instances }: WrittenTemplate) =>
  revision === 1
    ? `Template ${id} r1 is in the deck: add kind component with component ${id} to place it.`
    : `Template ${id} is at r${revision}, with ${instances} instances rebuilt.`
