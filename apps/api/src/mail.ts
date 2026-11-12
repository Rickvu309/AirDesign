import { signInRoutes } from "@airdesign/catalog"

export type Mail = {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
}

export type Sender = (mail: Mail) => Promise<void>

export function signLink(publicOrigin: string, token: string): string {
  return `${publicOrigin}${signInRoutes.link.path}?token=${encodeURIComponent(token)}`
}

export type ResendAccount = {
  readonly key: string
  readonly from: string
}

export async function sendWithResend(mail: Mail, { key, from }: ResendAccount): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  })
  if (!response.ok) {
    throw new Error("resend refused the message")
  }
}
