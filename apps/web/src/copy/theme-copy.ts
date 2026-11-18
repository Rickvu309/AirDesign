import { formatCopy } from "./format-copy"

export const themeCopy = {
  section: "Theme",
  name: "Name",
  ...formatCopy.colors,
  hlink: "Link",
  folHlink: "Visited link",
  major: "Heading font",
  minor: "Body font",
  custom: "Added colors",
  removed: "Delete template style",
} as const
