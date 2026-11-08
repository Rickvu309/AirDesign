export const iconPaths = {
  undo: "M3 7h11a6 6 0 0 1 0 12M3 7l4-4M3 7l4 4",
  redo: "M21 7H10a6 6 0 0 0 0 12M21 7l-4-4M21 7l-4 4",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  recent: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  decks: "M7 7V3h14v14h-4M3 7h14v14H3z",
  presentation: "M2 4h20M4 4v14h16V4M12 18l-5 5M12 18l5 5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  settings: "M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1zM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  grid: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z",
  list: "M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1",
  chevron: "M7 10l5 5 5-5",
  plug: "M9 3v5M15 3v5M6 8h12v5a6 6 0 0 1-12 0zM12 19v3",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  plus: "M12 4v16M4 12h16",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  file: "M14 2H5v20h14V7zm0 0v6h5",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
}

export type IconName = keyof typeof iconPaths
export function isIconName(name:string):name is IconName{
  return Object.hasOwn(iconPaths,name)
}
export function iconStrokeWidth(name:IconName):1.5|1.6{
  return name==="undo"||name==="redo" ? 1.5 : 1.6
}
