export const iconNamePattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$"

const iconName = new RegExp(iconNamePattern)
const iconLength = 64

export function readAsset(raw: unknown): string | null {
  return typeof raw === "string" ? assetIcon(raw) : null
}

export function assetIcon(ref: string): string | null {
  return ref.length <= iconLength && iconName.test(ref) ? ref : null
}
