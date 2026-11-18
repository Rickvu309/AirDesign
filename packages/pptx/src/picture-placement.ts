type Size = { readonly width: number; readonly height: number }

export function picturePlacement(mode: "fill" | "fit", image: Size, box: Size) {
  const scale = Math[mode === "fill" ? "max" : "min"](box.width / image.width, box.height / image.height)
  const l = Math.round((1 - (image.width * scale) / box.width) * 50000)
  const t = Math.round((1 - (image.height * scale) / box.height) * 50000)
  return { l: l === 0 ? 0 : l, t: t === 0 ? 0 : t, r: l === 0 ? 0 : l, b: t === 0 ? 0 : t }
}

export function placementXml(mode: "fill" | "fit", image: Size, box: Size): string {
  const rect = picturePlacement(mode, image, box)
  return mode === "fit" && rect.l === 0
    ? `<a:stretch><a:fillRect t="${rect.t}" b="${rect.b}"/></a:stretch>`
    : `<a:stretch><a:fillRect l="${rect.l}" t="${rect.t}" r="${rect.r}" b="${rect.b}"/></a:stretch>`
}
