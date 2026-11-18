import { formatCopy } from "./format-copy"

export const templateStyleCopy = {
  section: "Template style details",
  name: "Name",
  ...formatCopy.colors,
  hlink: "Link",
  folHlink: "Visited link",
  major: "Heading font",
  minor: "Body font",
  custom: "Added colors",
  removed: "Delete template style",
  textStyle: "Text style",
} as const
