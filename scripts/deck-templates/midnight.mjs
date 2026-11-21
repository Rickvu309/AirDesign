import { layouts, master } from "./deck-layouts.mjs"
import { boardSlides } from "./board-slides.mjs"

const muted = "tx2"
const hairline = "tx1 lumMod 20000 lumOff 0"

const scale = {
  title: { size: 28, font: "+mj-lt", color: "tx1", lineHeight: 1.05 },
  heading: { size: 20, font: "+mj-lt", color: "tx1", lineHeight: 1.1, after: 4 },
  body: {
    size: 16,
    font: "+mn-lt",
    color: "tx1",
    lineHeight: 1.25,
    after: 8,
    bullet: { char: "•", indent: 16, hang: 16, color: "accent1" },
  },
  body2: {
    size: 14,
    font: "+mn-lt",
    color: muted,
    lineHeight: 1.25,
    after: 6,
    bullet: { char: "–", indent: 34, hang: 16, color: muted },
  },
  body3: {
    size: 14,
    font: "+mn-lt",
    color: muted,
    lineHeight: 1.25,
    after: 4,
    bullet: { char: "–", indent: 50, hang: 14, color: muted },
  },
  caption: { size: 11, font: "+mn-lt", color: muted, lineHeight: 1.2 },
  label: { size: 10, font: "+mj-lt", color: "accent1", lineHeight: 1.2, tracking: 1 },
  bigNumber: { size: 54, font: "+mj-lt", color: "accent1", lineHeight: 1 },
  subtitle: { size: 18, font: "+mn-lt", color: muted, lineHeight: 1.25 },
}

const look = {
  scale,
  headingMarks: [{ box: [48, 26, 32, 3], color: "accent1", name: "Accent" }],
  cover: {
    marks: [
      { box: [0, 0, 8, 540], color: "accent1", name: "Accent band" },
      { box: [48, 476, 864, 0.75], color: hairline },
    ],
    label: [48, 124, 600, 16],
    title: [48, 172, 800, 108],
    titleStyle: { ...scale.title, size: 44, lineHeight: 1.02 },
    subtitle: [48, 276, 760, 60],
    footer: [48, 490, 640, 16],
  },
  section: {
    marks: [{ box: [0, 0, 8, 540], color: "accent1", name: "Accent band" }],
    number: [48, 170, 300, 72],
    numberStyle: { ...scale.bigNumber, size: 64 },
    title: [48, 256, 760, 96],
    titleStyle: { ...scale.title, size: 36 },
  },
  closing: {
    marks: [{ box: [48, 152, 32, 3], color: "accent1", name: "Accent" }],
    title: [48, 172, 760, 80],
    titleStyle: { ...scale.title, size: 36 },
    body: [48, 256, 760, 140],
  },
}

export default {
  id: "midnight",
  name: "Midnight",
  map: "dark",
  colors: {
    dk1: "0E1626",
    lt1: "F4F6FA",
    dk2: "1A2438",
    lt2: "9AA6BA",
    accent1: "6B9BFF",
    accent2: "34C3A6",
    accent3: "F5B54A",
    accent4: "A98BFA",
    accent5: "F06A73",
    accent6: "8AD167",
    hlink: "7AA6FF",
    folHlink: "C3A9FF",
  },
  fonts: { major: "Inter SemiBold", minor: "Inter" },
  scale,
  master: master(look),
  layouts: layouts(look),
  slides: boardSlides(scale),
}
