import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-field-edge": "error" }
const source = "apps/web/src/settings/name-form.tsx"
const imports = 'import { Input } from "@/components/ui/input"; import { Textarea } from "@/components/ui/textarea";\n'
const message = "Keep field edges in packages/theme/src/tokens.css"

for (const classes of [
  "bg-background focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:-outline-offset-1 aria-invalid:border-danger-text aria-invalid:ring-0 aria-invalid:focus-visible:border-danger-text aria-invalid:focus-visible:outline-danger-text",
  "max-h-40 min-h-16 resize-none border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)] aria-invalid:shadow-[0px_0px_0px_2px_var(--destructive)] md:text-[length:var(--type-dense)]",
  "h-7 rounded-md border-0 bg-background pl-9 text-[length:var(--type-dense)] shadow-[0_0_0_1px_var(--line)] placeholder:text-quiet md:text-[length:var(--type-dense)]",
]) {
  expectRejects(
    "a shipped competing edge fails",
    source,
    `${imports}export const field = <Textarea className=${JSON.stringify(classes)} />`,
    rule,
    message,
  )
}
expectRejects(
  "an alias fails",
  source,
  'import { Input as Field } from "@/components/ui/input"; export const field = <Field className="focus:ring-2" />',
  rule,
  message,
)
expectRejects(
  "a namespace fails",
  source,
  'import * as Fields from "@/components/ui/input"; export const field = <Fields.Input className="outline-none" />',
  rule,
  message,
)
expectRejects(
  "a conditional class fails",
  source,
  `${imports}const edge = "shadow-sm"; export const field = <Input className={cn("bg-white", invalid && edge)} />`,
  rule,
  message,
)
expectRejects(
  "an object class fails",
  source,
  `${imports}export const field = <Input className={cn({"border-0": true})} />`,
  rule,
  message,
)
expectRejects(
  "an arbitrary CSS edge fails",
  source,
  `${imports}export const field = <Input className="[box-shadow:var(--shadow-card)]" />`,
  rule,
  message,
)
expectRejects(
  "an inline edge fails",
  source,
  `${imports}export const field = <Input style={{ outline: "none" }} />`,
  rule,
  message,
)
expectRejects(
  "a stored inline edge fails",
  source,
  `${imports}const style = { boxShadow: "none" }; export const field = <Input style={style} />`,
  rule,
  message,
)
for (const attribute of ["data-focus-edge", 'data-slot="custom"']) {
  expectRejects(
    "a focus owner override fails",
    source,
    `${imports}export const field = <Input ${attribute} />`,
    rule,
    message,
  )
}
expectAccepts(
  "layout and surface classes stay",
  source,
  `${imports}export const field = <Input className="h-9 rounded-md bg-white px-3 text-base disabled:opacity-50" aria-invalid={invalid} />`,
  rule,
)
expectAccepts(
  "inline layout stays",
  source,
  `${imports}export const field = <Textarea style={{ width: "100%", borderRadius: 6 }} />`,
  rule,
)
expectAccepts(
  "an unrelated Input stays",
  source,
  'import { Input } from "other-library"; export const field = <Input className="ring-2" />',
  rule,
)
expectAccepts(
  "a grouped native control stays",
  source,
  'export const field = <label data-focus-ring><input className="outline-none" /></label>',
  rule,
)
