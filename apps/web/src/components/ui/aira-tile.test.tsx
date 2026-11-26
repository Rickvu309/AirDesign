import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { AiraTile } from "@/components/ui/aira-tile"
import { SparkIcon } from "@/components/ui/editor-icons"

it("draws Aira with the same spark the editor's Agent tab draws, at both sizes", () => {
  expect(renderToStaticMarkup(<AiraTile />)).toContain(renderToStaticMarkup(<SparkIcon size={16} />))
  expect(renderToStaticMarkup(<AiraTile large />)).toContain(renderToStaticMarkup(<SparkIcon size={20} />))
})
