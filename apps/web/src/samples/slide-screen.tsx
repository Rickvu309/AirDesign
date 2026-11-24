import { DoomSlide } from "@airdesign/render"
import * as doom from "@airdesign/doom"
import { landscapeUrl } from "@/samples/landscape-art"
import { pictureAsset } from "@/samples/slides/picture-crop"

const slideWidth = 1280

const assetUrl = (asset: string) => (asset === pictureAsset ? landscapeUrl : undefined)

export function SlideScreen({ grown }: { readonly grown: doom.Grown }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-8">
      <div className="overflow-hidden rounded-md shadow-card">
        <DoomSlide doom={grown.doom} slide={grown.slides[0]!} width={slideWidth} assetUrl={assetUrl} />
      </div>
    </main>
  )
}
