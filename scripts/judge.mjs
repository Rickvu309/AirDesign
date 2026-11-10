export const judge = async (pptx, before, after) => {
  const errors = pptx.newValidatorErrors(before.list, after.list)
  const ranges =
    before.parts === undefined || after.parts === undefined
      ? []
      : pptx.newValidatorErrors(await pptx.chartRangeFaults(before.parts), await pptx.chartRangeFaults(after.parts))
  const dupes = pptx.newDuplicateShapeIds(before.ids, after.ids)
  return {
    errors: [...errors, ...ranges],
    dupes,
    accepted: errors.length === 0 && ranges.length === 0 && dupes.length === 0,
  }
}
