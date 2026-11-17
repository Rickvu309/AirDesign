export const fontCopy = {
  unknown: (family: string) => `“${family}” is not available. The slide uses a fallback font.`,
  unavailable: (family: string) => `Unable to load “${family}”. The slide uses a fallback font.`,
}
