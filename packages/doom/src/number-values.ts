type NumberValue = {
  readonly worded: boolean
}

const shape =
  /^(\()?([-−+])?([$€£¥])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(%|x|[kmb]n?|pts?|pp)?(?:\s+([a-z]{1,4})\.?)?(\))?$/i
const year = /^(?:19|20)\d{2}$/
const blank = /^(?:[-–—]|n\/?a)$/i

export function numberValue(text: string): NumberValue | undefined {
  const found = shape.exec(text.trim())
  if (found === null) return undefined
  const [, open, , , , , , word, close] = found
  if ((open === undefined) !== (close === undefined)) return undefined
  return { worded: word !== undefined }
}

export const isDataValue = (text: string): boolean => numberValue(text)?.worded === false && !year.test(text.trim())

export const isBlankValue = (text: string): boolean => text.trim() === "" || blank.test(text.trim())
