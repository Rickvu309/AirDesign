import type { TraitWire } from "./trait-wire.js"

function hex(digits: string): `#${string}` {
  return `#${digits}`
}

export const themeWire: TraitWire<"theme"> = {
  description:
    "deck.theme sets every theme. deck.templateN, N from templates[].node, sets that template. A deleted template is omitted and its number is not reused.",
  fields: {
    name: { description: "Template name in this deck.", example: { theme: { name: "Light slides" } } },
    dk1: { description: "Dark 1, usually tx1.", example: { theme: { dk1: hex("1F1F1F") } } },
    lt1: { description: "Light 1, usually bg1.", example: { theme: { lt1: hex("FFFDF7") } } },
    dk2: { description: "Dark 2, usually tx2.", example: { theme: { dk2: hex("1F4E79") } } },
    lt2: { description: "Light 2, usually bg2.", example: { theme: { lt2: hex("EDF2F9") } } },
    accent1: { description: "Accent 1.", example: { theme: { accent1: hex("C00000") } } },
    accent2: { description: "Accent 2.", example: { theme: { accent2: hex("00B050") } } },
    accent3: { description: "Accent 3.", example: { theme: { accent3: hex("7030A0") } } },
    accent4: { description: "Accent 4.", example: { theme: { accent4: hex("FF6600") } } },
    accent5: { description: "Accent 5.", example: { theme: { accent5: hex("0070C0") } } },
    accent6: { description: "Accent 6.", example: { theme: { accent6: hex("2E8B57") } } },
    hlink: { description: "Link text.", example: { theme: { hlink: hex("0000EE") } } },
    folHlink: { description: "A visited link's text.", example: { theme: { folHlink: hex("7F3F98") } } },
    major: { description: "Heading font.", example: { theme: { major: "Georgia" } } },
    minor: { description: "Body font.", example: { theme: { minor: "Verdana" } } },
    custom: {
      description: "Named colors stored in the theme. A shape cannot reference one, so applying it stores the hex.",
      example: { theme: { custom: [{ name: "Coral", color: hex("FF6600") }] } },
    },
    removed: {
      description: "Delete this template when no slide uses it. Target deck.templateN, not deck.theme.",
      example: { theme: { removed: true } },
    },
  },
}
