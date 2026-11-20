export const layersCopy = {
  section: "Layers",
  listName: "Layers on this slide",
  empty: "This slide has no layers.",
  rename: (name: string) => `Rename ${name}`,
  moved: (name: string) => `Moved ${name}`,
  movedInto: (name: string, group: string) => `Moved ${name} into ${group}`,
  hidden: "Hidden",
  hide: (name: string) => `Hide ${name}`,
  show: (name: string) => `Show ${name}`,
  locked: "Locked",
  lock: (name: string) => `Lock ${name}`,
  unlock: (name: string) => `Unlock ${name}`,
} as const
