export const unshownCopy = {
  picture: (format: string | null) =>
    format === null ? "Image can't be shown here" : `${format} image can't be shown here`,
  frame: "This object can't be shown here",
} as const
