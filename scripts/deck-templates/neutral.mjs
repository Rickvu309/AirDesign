import { templateTheme } from "../../packages/templates/src/index.ts"
import { boxes, layouts, master } from "./deck-layouts.mjs"
import { boardSlides } from "./board-slides.mjs"

const grey = "tx1 lumMod 60000 lumOff 40000"
const hairline = "tx1 lumMod 15000 lumOff 85000"

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
    color: grey,
    lineHeight: 1.25,
    after: 6,
    bullet: { char: "–", indent: 34, hang: 16, color: grey },
  },
  body3: {
    size: 14,
    font: "+mn-lt",
    color: grey,
    lineHeight: 1.25,
    after: 4,
    bullet: { char: "–", indent: 50, hang: 14, color: grey },
  },
  caption: { size: 11, font: "+mn-lt", color: grey, lineHeight: 1.2 },
  label: { size: 10, font: "+mj-lt", color: "accent1", lineHeight: 1.2, tracking: 1 },
  bigNumber: { size: 54, font: "+mj-lt", color: "tx2", lineHeight: 1 },
  subtitle: { size: 18, font: "+mn-lt", color: grey, lineHeight: 1.25 },
}

const look = {
  scale,
  headingMarks: [{ box: boxes.rule, color: hairline }],
  cover: {
    marks: [
      { box: [48, 152, 40, 4], color: "accent1", name: "Accent" },
      { box: [48, 476, 864, 0.75], color: hairline },
    ],
    label: [48, 124, 600, 16],
    title: [48, 172, 760, 108],
    titleStyle: { ...scale.title, size: 40, lineHeight: 1.05 },
    subtitle: [48, 276, 760, 60],
    footer: [48, 490, 640, 16],
  },
  section: {
    marks: [{ box: [48, 254, 864, 0.75], color: hairline }],
    number: [48, 176, 300, 64],
    numberStyle: { ...scale.bigNumber, color: "accent1" },
    title: [48, 270, 760, 96],
    titleStyle: { ...scale.title, size: 32 },
  },
  closing: {
    marks: [{ box: [48, 152, 40, 4], color: "accent1", name: "Accent" }],
    title: [48, 172, 760, 80],
    titleStyle: { ...scale.title, size: 36 },
    body: [48, 256, 760, 140],
  },
}

export default {
  ...templateTheme("neutral"),
  scale,
  master: master(look),
  layouts: layouts(look),
  slides: boardSlides(scale),
}
