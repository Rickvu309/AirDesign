import {it,expect} from "vitest"
import {createServer} from "node:http"
import {createResendMail} from "../src/resend-mail.ts"

it("delivers a sign-in code and link only to the configured mail endpoint",async () => {
  let body = "", authorization = ""
  const server = createServer((request,response) => {
    authorization = request.headers.authorization ?? ""
    request.on("data",chunk => { body += chunk.toString() })
    request.on("end",() => { response.writeHead(200,{"content-type":"application/json"}); response.end('{"id":"local"}') })
  })
  await new Promise<void>(resolve => { server.listen(0,"127.0.0.1",resolve) })
  const address=server.address()
  if (!address || typeof address === "string") throw new Error("missing-test-port")
  try {
    const mail=createResendMail({apiKey:"mock",from:"AirDesign <test@example.invalid>",publicOrigin:"https://studio.example.invalid",endpoint:`http://127.0.0.1:${address.port}/emails`})
    await mail.send({to:"person@example.invalid",code:"123456",linkToken:"token",linkPath:"/api/access/link?token=token",sentAt:Date.now()})
    expect(authorization).toBe("Bearer mock")
    expect(JSON.parse(body)).toMatchObject({to:["person@example.invalid"],text:expect.stringContaining("123456")})
    expect(JSON.parse(body).text).toContain("https://studio.example.invalid/api/access/link?token=token")
  } finally { await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections()}) }
})
it("refuses incomplete mail configuration",()=>{
  expect(()=>createResendMail({apiKey:"key",from:"",publicOrigin:"https://studio.example.invalid"})).toThrow("MAIL_FROM")
})
