export const imageAddressLength = 2048

export const imageAddressPattern = "^https://\\S+$"

const imageAddress = new RegExp(imageAddressPattern)

export function webImage(text: string): boolean {
  return text.length <= imageAddressLength && imageAddress.test(text)
}
