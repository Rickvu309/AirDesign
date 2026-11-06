import {expect,it,vi} from "vitest"
import {convertWithFreshProfile} from "./office-process.ts"

it("restarts conversion once after LibreOffice initializes its fresh profile",()=>{
  const execute=vi.fn().mockReturnValueOnce({status:81,stdout:"",stderr:""}).mockReturnValueOnce({status:0,stdout:"converted",stderr:""})
  expect(convertWithFreshProfile("soffice",[],execute)).toEqual({attempts:[{status:81,stdout:"",stderr:""},{status:0,stdout:"converted",stderr:""}],stdout:"converted"})
  expect(execute).toHaveBeenCalledTimes(2)
})

it.each([0,1,81])("does not retry conversion indefinitely after exit %i",status=>{
  const execute=vi.fn(()=>({status,stdout:"",stderr:"conversion failure"}))
  if(status===0)expect(convertWithFreshProfile("soffice",[],execute).attempts).toHaveLength(1)
  else expect(()=>convertWithFreshProfile("soffice",[],execute)).toThrow("conversion failure")
  expect(execute).toHaveBeenCalledTimes(status===81?2:1)
})
