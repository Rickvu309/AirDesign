import { templateTheme } from "../../packages/templates/src/index.ts"
import { boxes, layouts, master } from "./deck-layouts.mjs"
import { boardSlides } from "./board-slides.mjs"

const muted = "tx1 lumMod 65000 lumOff 35000"
const ink = "tx1"

const scale = {
  title: { size: 30, font: "+mj-lt", color: "tx1", lineHeight: 1.05 },
  heading: { size: 20, font: "+mj-lt", color: "tx1", lineHeight: 1.1, after: 4 },
  body: {
    size: 16,
    font: "+mn-lt",
    color: "tx1",
    lineHeight: 1.3,
    after: 8,
    bullet: { char: "•", indent: 16, hang: 16, color: "accent1" },
  },
  body2: {
    size: 14,
    font: "+mn-lt",
    color: muted,
    lineHeight: 1.3,
    after: 6,
    bullet: { char: "–", indent: 34, hang: 16, color: muted },
  },
  body3: {
    size: 14,
    font: "+mn-lt",
    color: muted,
    lineHeight: 1.3,
    after: 4,
    bullet: { char: "–", indent: 50, hang: 14, color: muted },
  },
  caption: { size: 11, font: "+mn-lt", color: muted, lineHeight: 1.2 },
  label: { size: 10, font: "Inter SemiBold", color: "accent1", lineHeight: 1.2, tracking: 1.5 },
  bigNumber: { size: 56, font: "+mj-lt", color: "accent1", lineHeight: 1 },
  subtitle: { size: 18, font: "+mn-lt", color: muted, lineHeight: 1.3 },
}

const look = {
  scale,
  headingMarks: [{ box: boxes.rule, color: ink }],
  cover: {
    marks: [
      { box: [48, 40, 864, 1.5], color: ink, name: "Top rule" },
      { box: [48, 476, 864, 0.75], color: ink },
    ],
    label: [48, 124, 600, 16],
    title: [48, 172, 800, 108],
    titleStyle: { ...scale.title, size: 48, lineHeight: 1 },
    subtitle: [48, 276, 760, 60],
    footer: [48, 490, 640, 16],
  },
  section: {
    marks: [{ box: [48, 40, 864, 1.5], color: ink, name: "Top rule" }],
    number: [48, 150, 300, 96],
    numberStyle: { ...scale.bigNumber, size: 88 },
    title: [48, 260, 760, 96],
    titleStyle: { ...scale.title, size: 36 },
  },
  closing: {
    marks: [{ box: [48, 40, 864, 1.5], color: ink, name: "Top rule" }],
    title: [48, 172, 760, 80],
    titleStyle: { ...scale.title, size: 40 },
    body: [48, 256, 760, 140],
  },
}

export default {
  ...templateTheme("editorial"),
  scale,
  table: { id: "{2D1C7E5A-6B0F-4C3E-9A41-7E5B2C8D1F03}", rule: "tx1 lumMod 25000 lumOff 75000", headRule: ink },
  master: master(look),
  layouts: layouts(look),
  slides: boardSlides(scale),
}
