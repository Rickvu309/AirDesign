import { iconNamePattern } from "@airdesign/document"

export const imageAddressLength = 2048

export const imageAddressPattern = "^https://\\S+$"

const imageAddress = new RegExp(imageAddressPattern)

export const pictureSourcePattern = `^(?:${iconNamePattern.slice(1, -1)}|https://\\S+)$`

export function webImage(text: string): boolean {
  return text.length <= imageAddressLength && imageAddress.test(text)
}
