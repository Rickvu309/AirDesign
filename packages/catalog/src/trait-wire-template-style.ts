import type { TraitWire } from "./trait-wire.js"

function hex(digits: string): `#${string}` {
  return `#${digits}`
}

export const templateStyleWire: TraitWire<"templateStyle"> = {
  description:
    "On a slide, id picks its template style, keeping geometry, placeholders and explicit formatting. deck.templateStyles sets them all; deck.templateStyleN (N from templateStyles[].node) sets one.",
  fields: {
    id: {
      description: "A template style id from read_deck.templateStyles.",
      example: { templateStyle: { id: "ppt/theme/theme2.xml" } },
    },
    name: { description: "Template style name in this deck.", example: { templateStyle: { name: "Light slides" } } },
    dk1: { description: "Dark 1, usually tx1.", example: { templateStyle: { dk1: hex("1F1F1F") } } },
    lt1: { description: "Light 1, usually bg1.", example: { templateStyle: { lt1: hex("FFFDF7") } } },
    dk2: { description: "Dark 2, usually tx2.", example: { templateStyle: { dk2: hex("1F4E79") } } },
    lt2: { description: "Light 2, usually bg2.", example: { templateStyle: { lt2: hex("EDF2F9") } } },
    accent1: { description: "Accent 1.", example: { templateStyle: { accent1: hex("C00000") } } },
    accent2: { description: "Accent 2.", example: { templateStyle: { accent2: hex("00B050") } } },
    accent3: { description: "Accent 3.", example: { templateStyle: { accent3: hex("7030A0") } } },
    accent4: { description: "Accent 4.", example: { templateStyle: { accent4: hex("FF6600") } } },
    accent5: { description: "Accent 5.", example: { templateStyle: { accent5: hex("0070C0") } } },
    accent6: { description: "Accent 6.", example: { templateStyle: { accent6: hex("2E8B57") } } },
    hlink: { description: "Link text.", example: { templateStyle: { hlink: hex("0000EE") } } },
    folHlink: { description: "A visited link's text.", example: { templateStyle: { folHlink: hex("7F3F98") } } },
    major: { description: "Heading font.", example: { templateStyle: { major: "Georgia" } } },
    minor: { description: "Body font.", example: { templateStyle: { minor: "Verdana" } } },
    custom: {
      description: "Named template style colors; a shape cannot use one, so applying it stores the hex.",
      example: { templateStyle: { custom: [{ name: "Coral", color: hex("FF6600") }] } },
    },
    removed: {
      description: "Delete this template style when no slide uses it. Target deck.templateStyleN.",
      example: { templateStyle: { removed: true } },
    },
    textStyle: {
      description: "Each entry updates one textStyles id and leaves the other edits.",
      example: {
        templateStyle: {
          textStyle: [{ id: "ppt/slideMasters/slideMaster1.xml/titleStyle/0", size: 32, font: "Georgia" }],
        },
      },
    },
  },
}
