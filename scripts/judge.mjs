export const judge = (pptx, before, after) => {
  const errors = [
    ...pptx.newValidatorErrors(before.list, after.list),
    ...pptx.newValidatorErrors(before.orders, after.orders),
  ]
  const dupes = pptx.newDuplicateShapeIds(before.ids, after.ids)
  const dangling = after.dangling ?? []
  return { errors, dupes, dangling, accepted: errors.length === 0 && dupes.length === 0 && dangling.length === 0 }
}

export const judgeParts = (pptx, before, list, parts) =>
  judge(pptx, before, {
    list,
    ids: pptx.shapeIdCounts(parts),
    orders: pptx.branchOrderErrors(parts),
    dangling: pptx.newDanglingShapeReferences(before.references, pptx.danglingShapeReferences(parts)),
  })
