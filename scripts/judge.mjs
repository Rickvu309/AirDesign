export const judge = (pptx, before, after) => {
  const errors = [
    ...pptx.newValidatorErrors(before.list, after.list),
    ...pptx.newValidatorErrors(before.orders, after.orders),
  ]
  const dupes = pptx.newDuplicateShapeIds(before.ids, after.ids)
  const dangling = pptx.newDanglingShapeReferences(before.references, after.references)
  return { errors, dupes, dangling, accepted: errors.length === 0 && dupes.length === 0 && dangling.length === 0 }
}
