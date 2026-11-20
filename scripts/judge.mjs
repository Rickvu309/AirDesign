export const sharedPartLine = (row) => `Shared part: ${row.part} belongs to ${row.owners.join(" and ")}`

export const validatorBlindFaults = (pptx, parts) => [
  ...pptx.branchOrderErrors(parts),
  ...pptx.chartWorkbookErrors(parts),
]

export const judge = (pptx, before, after) => {
  const errors = [
    ...pptx.newValidatorErrors(before.list, after.list, after.copies),
    ...pptx.newValidatorErrors(before.orders, after.orders),
    ...(after.shared ?? []).map(sharedPartLine),
  ]
  const dupes = pptx.newDuplicateShapeIds(before.ids, after.ids)
  const dangling = after.dangling ?? []
  return { errors, dupes, dangling, accepted: errors.length === 0 && dupes.length === 0 && dangling.length === 0 }
}

export const judgeParts = (pptx, before, list, parts) =>
  judge(pptx, before, {
    list,
    ids: pptx.shapeIdCounts(parts),
    orders: validatorBlindFaults(pptx, parts),
    dangling: pptx.newDanglingShapeReferences(before.references, pptx.danglingShapeReferences(parts)),
    shared: pptx.newSharedOwnedParts(before.shared, pptx.sharedOwnedParts(parts)),
  })
