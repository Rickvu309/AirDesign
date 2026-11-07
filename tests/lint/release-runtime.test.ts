import {it,expect} from "vitest"
import {readFileSync} from "node:fs"
import {z} from "zod"
import {releaseRuntimeHits} from "../../scripts/lint/release-runtime.ts"

const originals=z.array(z.object({file:z.string(),revision:z.string(),source:z.string()})).parse(JSON.parse(readFileSync(new URL("./fixtures/release-original-mistakes.json",import.meta.url),"utf8")))

it.each(originals)("rejects original $revision release mistake and accepts the fix in $file",({file,source})=>{
 expect(releaseRuntimeHits(file,source)).not.toEqual([])
 expect(releaseRuntimeHits(file,readFileSync(file,"utf8"))).toEqual([])
})
