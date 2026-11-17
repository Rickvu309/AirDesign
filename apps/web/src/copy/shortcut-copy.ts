export function shortcutCopy(keys: string): string {
  const platform = typeof navigator === "undefined" ? "" : navigator.platform
  return /Mac|iPhone|iPad|iPod/.test(platform)
    ? `${keys.startsWith("Shift+") ? "⇧" : ""}⌘${keys.replace("Shift+", "")}`
    : `Ctrl+${keys}`
}
