import { existsSync } from "node:fs"
import { startServer } from "../src/main.ts"
import { expect,it } from "vitest"
import sharp from "sharp"
import { createHistoryStore } from "../src/db/history-store.ts"
import { writeSavedPptx } from "../../../packages/pptx/src/export-deck.ts"
import { readArchive } from "../../../packages/pptx/src/archive.ts"
import { validateImage } from "../../../packages/files/src/assets/validate.ts"
import { uploadProvenance } from "../../../packages/files/src/assets/provenance.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { id,type Element } from "../../../packages/deck/src/index.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"

it("deduplicates parallel owned originals, isolates owners, retains used originals and snapshots export bytes",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"},other={personId:"other"}
  const image=await validateImage(await sharp({create:{width:640,height:320,channels:3,background:"blue"}}).png().toBuffer())
  try{
    const results=await Promise.all([store.images.adopt(owner,image,uploadProvenance),store.images.adopt(owner,image,uploadProvenance)])
    expect(results[0]).toEqual(results[1])
    expect((await store.images.list(owner)).assets).toHaveLength(1)
    const used=(await store.images.list(owner)).used
    await expect(store.images.get(other,image.hash)).rejects.toThrow("asset-not-found")
    await expect(store.images.media(other,image.hash,"original")).rejects.toThrow("asset-not-found")
    await expect(store.images.remove(other,image.hash)).rejects.toThrow("asset-not-found")
    expect((await store.images.adopt(other,image,uploadProvenance)).id).toBe(image.hash)
    const deck=fixtureDeck(1),picture:Element={id:id("picture"),kind:"image",image:{asset:image.hash,crop:{x:0,y:0,width:1,height:1},focal:{x:.5,y:.5},mask:"rectangle",alt:"A blue image"},box:{x:0,y:0,width:640,height:320},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null}
    deck.slides[0]!.elements=[picture]
    await store.create(owner,deck)
    await expect(store.create({personId:"stranger"},{...deck,id:id("foreign")})).rejects.toThrow("asset-not-found")
    await store.images.remove(owner,image.hash)
    expect((await store.images.list(owner)).assets).toEqual([])
    expect((await store.images.media(owner,image.hash,"original")).bytes).toEqual(Buffer.from(image.original,"base64"))
    await store.images.adopt(owner,image,uploadProvenance)
    expect((await store.images.list(owner)).used).toBe(used)
    await store.commit(owner,deck.id,{id:commandId("crop"),kind:"patch",base:0,run:null,target:picture.id,fields:{image:{...picture.image,crop:{x:.2,y:0,width:.8,height:1}}}})
    await store.commit(owner,deck.id,{id:commandId("undo-crop"),kind:"undo",target:commandId("crop")})
    expect((await store.read(owner,deck.id)).deck.slides[0]?.elements[0]).toEqual(picture)
  }finally{await store.close()}
})

it("keeps all in-memory job and template stores off the filesystem",async()=>{
  const server=await startServer(0,{operationsPath:":memory:",historyPath:"memory://",accessPath:"memory://"})
  try{expect(existsSync(":memory:.images")).toBe(false);expect(existsSync(":memory:.templates")).toBe(false)}finally{await server.close()}
})

it.each(["local-stock","heroicons"])("snapshots full resolution and immutable %s provenance for saved exports",async providerId=>{
  const {assetProviders}=await import("../../../packages/files/src/assets/providers.ts")
  const provider=assetProviders.find(provider=>provider.id===providerId)!
  const item=provider.search("")[0]!,source=await provider.read(item.id)
  const image=await validateImage(await sharp({create:{width:6000,height:1000,channels:3,background:"blue"}}).jpeg().withMetadata({orientation:6}).toBuffer())
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"}
  try{
    await store.images.adopt(owner,image,source.provenance)
    const deck=fixtureDeck(1)
    deck.slides[0]!.elements=[{...deck.slides[0]!.elements[0]!,kind:"image",image:{asset:image.hash,crop:{x:.1,y:0,width:.8,height:1},focal:{x:.5,y:.5},mask:"ellipse",alt:"Full size"}}]
    await store.create(owner,deck)
    const job=await store.exports.submit(owner,"export",deck.id,{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:true})
    const claimed=await store.exports.claim()
    expect(claimed).not.toBeNull()
    const snapshot=claimed!.snapshot
    expect.soft(snapshot).toHaveProperty("provenance",{[image.hash]:source.provenance})
    const bytes=Buffer.from(snapshot.assets![image.hash]!.split(",")[1]!,"base64")
    expect.soft(await sharp(bytes).metadata()).toMatchObject({width:1000,height:6000})
    const exported=await readArchive(await writeSavedPptx(snapshot.deck,snapshot.seq,null,{provenance:snapshot.provenance},snapshot.assets))
    const media=[...exported].find(([name])=>name.startsWith("ppt/media/"))!
    expect(await sharp(media[1]).metadata()).toMatchObject({width:1000,height:6000})
    const manifest=JSON.parse(exported.get("airdesign/saved-version.json")!.toString())
    expect(manifest.provenance).toEqual({[image.hash]:source.provenance})
    expect(job.kind).toBe("queued")
  }finally{await store.close()}
})
