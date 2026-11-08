import {expect,it} from "vitest"
import {fixtureDeck} from "../../../../packages/deck/src/fixture.ts"
import {id} from "../../../../packages/deck/src/index.ts"
import {scopeLabels} from "../chat/scope-labels.ts"
import {backgroundChanges} from "./design-changes.ts"
import {apply} from "../../../../packages/deck/src/index.ts"
it("uses shared content labels for text, shape and image targets without identifiers",()=>{
 const deck=fixtureDeck(2),slide=deck.slides[0]!,base=slide.elements[0]!
 slide.elements.push({...base,id:id("private_image_id"),kind:"image",image:{asset:"asset",crop:{x:0,y:0,width:1,height:1},focal:{x:.5,y:.5},mask:"rectangle",alt:"Team at work"}})
 const labels=scopeLabels(deck)
 expect(labels.get(slide.elements[1]!.id)).toBe("Slide 1 · Rectangle")
 expect(labels.get(id("private_image_id"))).toBe("Slide 1 · Team at work")
 expect([...labels.values()].join(" ")).not.toContain("private_image_id")
})
it("switches an image background back to a solid color atomically",()=>{
 const deck=fixtureDeck(1),slide=deck.slides[0]!,base=slide.elements[0]!
 slide.elements.unshift({...base,id:id("background_image"),kind:"image",box:{x:0,y:0,...slide.size},image:{asset:"asset",crop:{x:0,y:0,width:1,height:1},focal:{x:.5,y:.5},mask:"rectangle",alt:"Background"}})
 const changed=apply(deck,backgroundChanges(deck,[slide.id],"#123456"))
 if(!changed.ok)throw new Error("background-change-failed")
 expect(changed.deck.slides[0]!.background).toBe("#123456")
 expect(changed.deck.slides[0]!.elements.map(element=>element.id)).not.toContain("background_image")
 expect(changed.deck.slides[0]!.elements).toHaveLength(slide.elements.length-1)
})
