export const layersCopy = {
  section: "Layers",
  listName: "Layers on this slide",
  empty: "This slide has no layers.",
  rename: (name: string) => `Rename ${name}`,
  moved: (name: string) => `Moved ${name}`,
  hidden: "Hidden",
  hide: (name: string) => `Hide ${name}`,
  show: (name: string) => `Show ${name}`,
} as const
