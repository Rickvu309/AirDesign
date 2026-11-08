export const mcpPin={protocol:"2025-11-25",sdk:"1.26.0",transport:"streamable-http"} as const
const string={type:"string",minLength:1,maxLength:200} as const
const integer={type:"integer",minimum:0} as const
const deck={deckId:string},version={...deck,savedVersion:integer},write={...deck,base:integer,requestId:{...string,maxLength:70}}
const page={cursor:string,limit:{type:"integer",minimum:1,maximum:50}}
const definitions=[
  ["get_deck","Read a saved deck outline, with stable slide ids. Page through the frozen snapshot.",{...deck,...page},["deckId"]],
  ["get_slide","Read complete JSON or JSX subtrees from one saved slide. Target rootId for a smaller subtree. JSON is authoritative.",{...deck,slideId:string,rootId:string,format:{type:"string",enum:["json","jsx"]},...page},["deckId","slideId"]],
  ["get_context","Read available workspace context. Remote clients have no active Studio selection.",{},[]],
  ["get_brand","Read one existing brand template and its versioned tokens.",{brandId:string,version:integer},["brandId"]],
  ["find_elements","Find element ids and summaries in one deck. Query matches text; kind filters element type.",{...deck,query:{type:"string",maxLength:200},kind:{type:"string",enum:["text","shape","image","group","paragraph","text-frame"]},...page},["deckId"]],
  ["list_decks","List your live decks, optionally searching title and slide text. No trash or deletion access.",{query:{type:"string",maxLength:200},...page},[]],
  ["search_assets","Search free stock photos, icons, or your uploaded image library. Returns provenance.",{query:{type:"string",maxLength:200},source:{type:"string",enum:["local-stock","heroicons","library"]},...page},[]],
  ["read_file","Read bounded text or a resource link for an owned file. Binary content stays in resources.",{fileId:string,offset:integer,length:{type:"integer",minimum:1,maximum:8000}},["fileId"]],
  ["add_file","Ingest a server-issued upload URL or public HTTPS file. No local paths or base64. Retries reuse requestId.",{sourceUrl:{type:"string",format:"uri",maxLength:2048},name:{...string,maxLength:200},requestId:string},["sourceUrl","name","requestId"]],
  ["export_deck","Queue a PowerPoint or PDF export of exactly savedVersion. Free. Poll get_operation for its resource.",{...version,format:{type:"string",enum:["pptx","pdf"]},requestId:string},["deckId","savedVersion","format","requestId"]],
  ["import_deck","Queue an owned PowerPoint file for import. Free. Poll get_operation; retry with the same requestId.",{fileId:string,requestId:string},["fileId","requestId"]],
  ["apply_changes","Atomically insert, set, move or remove slides, elements, paragraphs or text frames at base. Set replaces a complete JSON subtree, never partial fields. Never remove the deck root. Text child order is frame at 0 and paragraphs at 1 and above. Native text has body with frame and nonempty paragraphs; preserve their ids and endStyle. Legacy whole-element runs cannot replace native body. Stable ids are required; requestId is idempotent. Uses weekly usage; manual editing remains free.",{...write,changes:{type:"array",minItems:1,maxItems:100,items:{type:"object",required:["kind"],properties:{kind:{enum:["insert","set","move","remove"]},parent:string,target:string,index:integer,value:{type:"object"}},additionalProperties:false}}},["deckId","base","requestId","changes"]],
  ["create_deck","Create an owned deck with an existing optional brand. Retries reuse requestId.",{title:{...string,maxLength:200},brandId:string,requestId:string},["title","requestId"]],
  ["update_brand","Save a new version of an existing brand at base. Brand creation is available in Studio.",{brandId:string,base:integer,requestId:string,tokens:{type:"object",properties:{font:string,background:string,foreground:string,accent:string},additionalProperties:false}},["brandId","base","requestId","tokens"]],
  ["capture_slide","Capture one slide at exactly savedVersion as a native MCP PNG image, with bounded version metadata. Free.",{...version,slideId:string,width:{type:"integer",minimum:160,maximum:1920},format:{type:"string",enum:["png"]}},["deckId","slideId","savedVersion"]],
  ["check_deck","Check one saved version for invalid structure and unsupported content. Returns paged findings.",{...version,checks:{type:"array",items:{type:"string",enum:["structure","support"]},maxItems:2},...page},["deckId","savedVersion"]],
  ["get_operation","Read an owned import, export, or image operation. Ready results link to owned resources. Suggested polling interval is one second.",{operationId:string},["operationId"]],
  ["undo_change","Undo one named edit from this connection at base, preserving later person edits. Atomic conflicts leave the deck unchanged.",{...write,changeId:string},["deckId","base","requestId","changeId"]],
] as const
export const toolCatalog=definitions.map(([name,description,properties,required])=>({name,description,inputSchema:{type:"object" as const,properties,required:[...required],additionalProperties:false},annotations:{readOnlyHint:["get_deck","get_slide","get_context","get_brand","find_elements","list_decks","search_assets","read_file","capture_slide","check_deck","get_operation"].includes(name),destructiveHint:false,idempotentHint:true,openWorldHint:name==="add_file"}}))
export type ToolName=typeof definitions[number][0]
export function toolInput(name:string,value:unknown):Record<string,unknown> {
  const definition=toolCatalog.find(tool=>tool.name===name)
  if(!definition)throw new Error("unknown-tool")
  function validate(schema:unknown,input:unknown):void {
    if(!schema||typeof schema!=="object")throw new Error("invalid-schema")
    const get=(key:string):unknown=>Reflect.get(schema,key)
    const choices=get("enum");if(Array.isArray(choices)&&!choices.includes(input))throw new Error("invalid-tool-arguments")
    const type=get("type")
    if(type==="object"){
      if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("invalid-tool-arguments")
      const properties=get("properties"),required=get("required")
      if(Array.isArray(required)&&required.some(key=>typeof key!=="string"||!(key in input)))throw new Error("missing-tool-argument")
      if(properties&&typeof properties==="object")for(const [key,field] of Object.entries(input)){if(!(key in properties)){if(get("additionalProperties")===false)throw new Error("unknown-tool-argument")}else validate(Reflect.get(properties,key),field)}
    } else if(type==="string"){
      const min=get("minLength"),max=get("maxLength")
      if(typeof input!=="string"||(typeof min==="number"&&input.length<min)||(typeof max==="number"&&input.length>max))throw new Error("invalid-tool-arguments")
    } else if(type==="integer"){
      const min=get("minimum"),max=get("maximum")
      if(typeof input!=="number"||!Number.isSafeInteger(input)||(typeof min==="number"&&input<min)||(typeof max==="number"&&input>max))throw new Error("invalid-tool-arguments")
    } else if(type==="array"){
      const min=get("minItems"),max=get("maxItems")
      if(!Array.isArray(input)||(typeof min==="number"&&input.length<min)||(typeof max==="number"&&input.length>max))throw new Error("invalid-tool-arguments")
      for(const item of input)validate(get("items"),item)
    }
  }
  validate(definition.inputSchema,value)
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("invalid-tool-arguments")
  return Object.fromEntries(Object.entries(value))
}
