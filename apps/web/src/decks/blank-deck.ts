import { productCopy } from "@/copy/product-copy"
import blankUrl from "./blank.pptx?url&inline"

export async function blankDeck(): Promise<File> {
  const response = await fetch(blankUrl)
  return new File([await response.blob()], `${productCopy.blankDeck}.pptx`, {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    lastModified: 0,
  })
}
