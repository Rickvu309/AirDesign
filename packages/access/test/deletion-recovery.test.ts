import {expect,it,vi} from "vitest"
import {PGlite} from "@electric-sql/pglite"
import {createAccess,createMemoryInbox} from "../src/index.ts"
it("durably retries every interrupted cleanup step, blocking sessions before purge",async()=>{
  const db=await PGlite.create(),mail=createMemoryInbox()
  let failOwned=false,purged=false
  const options={driver:{kind:"pglite" as const,dataDir:"memory://",client:db},secret:"deletion-recovery-secret-at-least-32",mail,clock:Date.now,guard:{allow:()=>true},exposeInbox:true,deleteOwnedData:async()=>{if(failOwned)throw new Error("owned-failure");purged=true}}
  const create=vi.spyOn(PGlite,"create").mockResolvedValue(db)
  let access=await createAccess(options)
  try{
    await db.exec("CREATE FUNCTION airdesign.interrupt_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected-deletion-failure'; END $$")
    for(const step of ["session","owned","challenge","send_window","user","account_deletion_job"]){
      purged=false;let cookie=""
      const email=`${step}@example.com`
      const call=async(path:string,body?:unknown)=>{const response=await access.handle(new Request("http://127.0.0.1:41732"+path,{method:body ? "POST" : "GET",headers:{origin:"http://127.0.0.1:41732",cookie,"content-type":"application/json"},body:body ? JSON.stringify(body) : undefined}));const cookies=response.headers.getSetCookie().map(item=>item.split(";")[0]);if(cookies.length)cookie=cookies.join("; ");return response}
      const intent=await (await call("/api/access/intent",{kind:"home"})).json();await call("/api/access/email",{email,intent:intent.token});expect((await call("/api/access/code",{email,intent:intent.token,code:mail.read(email).at(-1)?.code})).status).toBe(200)
      const savedCookie=cookie
      if(step==="owned")failOwned=true
      else await db.exec(`CREATE TRIGGER fail_delete BEFORE DELETE ON airdesign."${step}" FOR EACH STATEMENT EXECUTE FUNCTION airdesign.interrupt_delete()`)
      await expect(call("/api/account/deletion",{confirm:"delete-account"})).rejects.toThrow()
      expect(await access.principal(new Request("http://127.0.0.1:41732/api/account",{headers:{cookie:savedCookie}}))).toBeNull()
      if(step==="session")expect(purged).toBe(false)
      expect((await db.query("SELECT owner FROM airdesign.account_deletion_job")).rows).toHaveLength(1)
      if(step==="owned")failOwned=false
      else await db.exec(`DROP TRIGGER fail_delete ON airdesign."${step}"`)
      await access.close();access=await createAccess(options);await access.resumeDeletions();await access.resumeDeletions()
      expect(purged).toBe(true)
      expect((await db.query('SELECT id FROM airdesign."user"')).rows).toHaveLength(0)
      expect((await db.query("SELECT owner FROM airdesign.account_deletion_job")).rows).toHaveLength(0)
    }
  }finally{create.mockRestore();await access.close();if(!db.closed)await db.close()}
},60000)
