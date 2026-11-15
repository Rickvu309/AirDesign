import { formatCopy } from "./format-copy"

export const themeCopy = {
  section: "Theme",
  ...formatCopy.colors,
  hlink: "Link",
  folHlink: "Visited link",
  major: "Heading font",
  minor: "Body font",
} as const
