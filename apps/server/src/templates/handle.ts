import { layoutFamilies } from "../../../../packages/brand/src/layout-families.ts"
import { mutationRejection, type Access } from "@airdesign/access"
import { commandId } from "../../../../packages/change-log/src/index.ts"
import { applyTemplate, type TemplateMode } from "../../../../packages/brand/src/index.ts"
import { TemplateStore } from "../../../../packages/brand/src/template-store.ts"
import type { HistoryStore } from "../db/history-store.ts"

export function templatesHandler(access: Access, store: TemplateStore, history: HistoryStore, origin: string, changed: (deck: string) => Promise<void>) {
  return async (request: Request): Promise<Response> => {
    const rejection=mutationRejection(request,origin)
    if (rejection) return Response.json(rejection,{status:rejection.status})
    const principal=await access.principal(request)
    if (!principal) return Response.json({code:"signed-out"},{status:401})
    try {
      const url=new URL(request.url)
      if (request.method === "GET" && url.pathname === "/api/templates") return Response.json({templates:store.list(principal),default:store.default(principal)})
      const body: unknown=await request.json()
      if (url.pathname === "/api/templates" && request.method === "POST") return Response.json(store.save(principal,body),{status:201})
      if (url.pathname === "/api/templates/from-deck" && request.method === "POST") {
        if (!body || typeof body !== "object" || !("deck" in body) || typeof body.deck !== "string" || !("name" in body) || typeof body.name !== "string" || !("id" in body) || typeof body.id !== "string") throw new Error("invalid-template-request")
        const snapshot=await history.read(principal,body.deck), original=await history.catalog.original(principal,body.deck)
        const relationships=original?.report.relationships
        const refs=Array.isArray(relationships) ? relationships.flatMap((rel:unknown) => rel && typeof rel === "object" && "part" in rel && typeof rel.part === "string" && "type" in rel && typeof rel.type === "string" && "target" in rel && typeof rel.target === "string" ? [{part:rel.part,type:rel.type,target:rel.target}] : []) : []
        const pinned=snapshot.deck.template ? store.get(principal,snapshot.deck.template.id,snapshot.deck.template.version) : null
        const importedFamilies=layoutFamilies(refs),families=importedFamilies.length ? importedFamilies : pinned?.families ?? []
        const theme=snapshot.deck.themes.find(theme=>theme.id===(snapshot.deck.template?.id ?? snapshot.deck.slides[0]?.theme)) ?? snapshot.deck.themes[0]
        const archive=original?.bytes ?? (pinned?.families.some(family=>family.master!==null) ? await history.templateSources.get(principal,pinned.id,pinned.version) : null)
        if(archive)await history.templateSources.save(principal,body.id,"version" in body ? Number(body.version) : 1,archive)
        return Response.json(store.save(principal,{id:body.id,version:"version" in body ? body.version : 1,name:body.name,font:theme?.font ?? "Geist",background:theme?.background ?? "#ffffff",foreground:theme?.foreground ?? pinned?.foreground ?? "#172333",accent:pinned?.accent ?? "#3e6fbe",fontRight:pinned && pinned.font===theme?.font ? pinned.fontRight : theme?.font && theme.font !== "Geist" ? "missing" : "installed",families:families.length ? families : [{id:"basic",name:"Basic",master:null,layouts:["Blank"]}]}),{status:201})
      }
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !("version" in body) || typeof body.version !== "number") throw new Error("invalid-template-request")
      if (url.pathname === "/api/templates/default" && request.method === "POST") return Response.json(store.setDefault(principal,body.id,body.version))
      if (url.pathname !== "/api/templates/apply" || request.method !== "POST") return Response.json({code:"not-found"},{status:404})
      if (!("deck" in body) || typeof body.deck !== "string" || !("requestId" in body) || typeof body.requestId !== "string" || !("mode" in body) || !("family" in body) || typeof body.family !== "string") throw new Error("invalid-template-request")
      const template=store.get(principal,body.id,body.version)
      if(template.families.some(family=>family.master!==null))await history.templateSources.get(principal,template.id,template.version)
      let mode: TemplateMode
      if (body.mode === "apply-deck") mode={kind:"apply-deck"}
      else if (body.mode === "insert-slide" && "slideId" in body && typeof body.slideId === "string") mode={kind:"insert-slide",slideId:body.slideId,family:body.family}
      else throw new Error("invalid-template-mode")
      const substitution="substitution" in body && body.substitution === "Geist" ? "Geist" : undefined
      let retained: string[]=[], warnings: string[]=[]
      const family=body.family
      const receipt=await history.commit(principal,body.deck,{id:commandId(body.requestId),kind:"edit",base:0,run:null,changes:{changes:[]}},{kind:"person"},{key:JSON.stringify({template,mode,family,substitution}),changes:deck => {
        const plan=applyTemplate(deck,template,mode,family,substitution)
        retained=plan.retained;warnings=plan.warnings
        return plan.changes
      }})
      await changed(body.deck)
      return Response.json({receipt,retained,warnings},{status:receipt.kind==="applied" ? 200 : 409})
    } catch (error) {
      const code=error instanceof Error ? error.message : "template-request-failed"
      return Response.json({code},{status:code.endsWith("not-found") ? 404 : 400})
    }
  }
}
