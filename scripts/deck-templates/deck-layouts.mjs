const side = 48
const width = 864

export const boxes = {
  title: [side, 34, width, 58],
  rule: [side, 100, width, 0.75],
  body: [side, 118, width, 352],
  left: [side, 118, 408, 352],
  right: [side + 456, 118, 408, 352],
  footer: [side, 500, 640, 16],
  number: [side + width - 48, 500, 48, 16],
}

const ph = {
  title: { type: "title", name: "Title" },
  centered: { type: "ctrTitle", name: "Title" },
  subtitle: { type: "subTitle", index: 1, name: "Subtitle" },
  body: { type: "body", index: 1, name: "Text" },
  content: { type: "obj", index: 1, name: "Content" },
  second: { type: "obj", index: 2, name: "Content" },
  label: { type: "body", index: 13, name: "Label" },
  footer: { type: "ftr", index: 11, name: "Footer" },
  number: { type: "sldNum", index: 12, name: "Slide number" },
}

const rule = (box, color, name = "Rule") => ({ kind: "rule", box, color, name })

export function master(look) {
  return [
    { ph: ph.title, box: boxes.title, body: { anchor: "b" }, prompt: "Title" },
    { ph: { type: "body", index: 1, name: "Text" }, box: boxes.body, prompt: "Text" },
    { ph: ph.footer, box: boxes.footer, style: look.scale.caption },
    { ph: ph.number, box: boxes.number, style: { ...look.scale.caption, align: "r" } },
  ]
}

function footer(look) {
  return [
    { ph: ph.footer, box: boxes.footer, style: look.scale.caption, key: "footer" },
    { ph: ph.number, box: boxes.number, style: { ...look.scale.caption, align: "r" } },
  ]
}

function heading(look) {
  return [
    ...look.headingMarks.map((mark) => rule(mark.box, mark.color, mark.name)),
    { ph: ph.title, box: boxes.title, body: { anchor: "b" }, prompt: "Title" },
  ]
}

export function layouts(look) {
  const cover = look.cover
  return [
    {
      name: "Title Slide",
      type: "title",
      shapes: [
        ...cover.marks.map((mark) => rule(mark.box, mark.color, mark.name)),
        { ph: ph.label, box: cover.label, style: look.scale.label, prompt: "Label", key: "label" },
        { ph: ph.centered, box: cover.title, body: { anchor: "t" }, style: cover.titleStyle, prompt: "Title" },
        { ph: ph.subtitle, box: cover.subtitle, style: look.scale.subtitle, prompt: "Subtitle", key: "subTitle" },
        { ph: ph.footer, box: cover.footer, style: look.scale.caption, key: "footer" },
      ],
    },
    {
      name: "Section Header",
      type: "secHead",
      shapes: [
        ...look.section.marks.map((mark) => rule(mark.box, mark.color, mark.name)),
        { ph: ph.label, box: look.section.number, style: look.section.numberStyle, prompt: "01", key: "label" },
        {
          ph: ph.title,
          box: look.section.title,
          body: { anchor: "t" },
          style: look.section.titleStyle,
          prompt: "Section title",
        },
        ...footer(look),
      ],
    },
    {
      name: "Title and Content",
      type: "obj",
      shapes: [...heading(look), { ph: ph.content, box: boxes.body, prompt: "Text" }, ...footer(look)],
    },
    {
      name: "Two Content",
      type: "twoObj",
      shapes: [
        ...heading(look),
        { ph: ph.content, box: boxes.left, prompt: "Text", key: "left" },
        { ph: ph.second, box: boxes.right, prompt: "Text", key: "right" },
        ...footer(look),
      ],
    },
    { name: "Title Only", type: "titleOnly", shapes: [...heading(look), ...footer(look)] },
    {
      name: "Closing",
      type: "cust",
      shapes: [
        ...look.closing.marks.map((mark) => rule(mark.box, mark.color, mark.name)),
        {
          ph: ph.title,
          box: look.closing.title,
          body: { anchor: "t" },
          style: look.closing.titleStyle,
          prompt: "Title",
        },
        { ph: ph.body, box: look.closing.body, style: look.scale.subtitle, prompt: "Text", key: "body" },
        ...footer(look),
      ],
    },
    {
      name: "Blank",
      type: "blank",
      shapes: [{ ph: ph.number, box: boxes.number, style: { ...look.scale.caption, align: "r" } }],
    },
  ]
}
