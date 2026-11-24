export function themeSlots({ id, name, colors, fonts, powerPoint }) {
  const { map, followedLink } = powerPoint
  const [dk1, lt1, dk2, lt2] =
    map === "dark"
      ? [colors.background, colors.text, colors.background2, colors.text2]
      : [colors.text, colors.background, colors.text2, colors.background2]
  const { text, background, text2, background2, link, ...accents } = colors
  const slots = { dk1, lt1, dk2, lt2, ...accents, hlink: link, folHlink: followedLink }
  return {
    id,
    name,
    map,
    colors: Object.fromEntries(Object.entries(slots).map(([slot, hex]) => [slot, hex.slice(1).toUpperCase()])),
    fonts: { major: fonts.heading, minor: fonts.body },
  }
}
