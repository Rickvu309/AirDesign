export const unshownCopy = {
  picture: (format: string | null) =>
    format === null ? "Picture can't be shown here" : `${format} picture can't be shown here`,
  frame: "Chart or diagram can't be shown here",
} as const
