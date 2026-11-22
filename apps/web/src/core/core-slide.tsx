import { SceneSlide } from "@airdesign/render"
import type { scene } from "@airdesign/document"
import { landscapeUrl } from "@/core/landscape"
import { pictureAsset } from "@/core/scenes/picture-crop"

const slideWidth = 1280

const assetUrl = (asset: string) => (asset === pictureAsset ? landscapeUrl : undefined)

export function CoreSlide({ grown }: { readonly grown: scene.Grown }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-8">
      <div className="overflow-hidden rounded-md shadow-card">
        <SceneSlide scene={grown.scene} slide={grown.slides[0]!} width={slideWidth} assetUrl={assetUrl} />
      </div>
    </main>
  )
}
