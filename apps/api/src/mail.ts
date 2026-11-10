export type Mail = {
  readonly to: string
  readonly text: string
}

export type Sender = (mail: Mail) => Promise<void>

export function signLink(host: string, token: string): string {
  return `https://${host}/sign-in/link?token=${encodeURIComponent(token)}`
}

export function mailText(host: string, token: string, code: string): string {
  return `${signLink(host, token)}\n${code}`
}

export async function sendWithResend(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (typeof key !== "string" || key.length === 0 || typeof from !== "string" || from.length === 0) {
    throw new Error("RESEND_API_KEY and RESEND_FROM are required")
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.text,
      text: mail.text,
    }),
  })
  if (!response.ok) {
    throw new Error("resend refused the message")
  }
}
