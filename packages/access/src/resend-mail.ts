import type {MailAdapter} from "./memory-inbox.ts"

export function createResendMail(options: {apiKey:string; from:string; publicOrigin:string; endpoint?:string}): MailAdapter {
  if (!options.apiKey.trim() || !options.from.trim()) throw new Error("Resend requires RESEND_API_KEY and MAIL_FROM")
  return {
    async send(message) {
      const response = await fetch(options.endpoint ?? "https://api.resend.com/emails", {
        method:"POST",
        headers:{authorization:`Bearer ${options.apiKey}`,"content-type":"application/json"},
        body:JSON.stringify({from:options.from,to:[message.to],subject:"Sign in to AirDesign",text:`Your AirDesign code is ${message.code}. Sign in: ${new URL(message.linkPath,options.publicOrigin).href}`}),
        signal:AbortSignal.timeout(10000),
        redirect:"error",
      })
      await response.body?.cancel()
      if (!response.ok) throw new Error(`mail-delivery-failed:${response.status}`)
    },
  }
}
