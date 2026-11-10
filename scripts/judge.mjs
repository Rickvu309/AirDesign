export const judge = (pptx, before, after) => {
  const errors = pptx.newValidatorErrors(before.list, after.list)
  const dupes = pptx.newDuplicateShapeIds(before.ids, after.ids)
  return { errors, dupes, accepted: errors.length === 0 && dupes.length === 0 }
}
