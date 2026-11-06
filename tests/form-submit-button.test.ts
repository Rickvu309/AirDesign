import {expect,it} from "vitest"
import {formSubmitButtonHits} from "../scripts/lint/form-submit-button.ts"
it("rejects inert form actions and accepts explicit submit or click actions",()=>{
  const file="apps/studio/src/settings/add-credits.tsx"
  expect(formSubmitButtonHits(file,'<form><div><Button disabled={busy}>Continue</Button></div></form>')).toHaveLength(1)
  for(const source of ['<form><Button type="submit">Continue</Button></form>','<form><Button onClick={close}>Close</Button></form>','<Button>Open</Button>'])expect(formSubmitButtonHits(file,source)).toEqual([])
})
