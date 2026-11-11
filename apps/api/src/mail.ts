import { signInRoutes } from "@airdesign/catalog"

export type Mail = {
  readonly to: string
  readonly text: string
}

export type Sender = (mail: Mail) => Promise<void>

export function signLink(publicOrigin: string, token: string): string {
  return `${publicOrigin}${signInRoutes.link.path}?token=${encodeURIComponent(token)}`
}

export function mailText(publicOrigin: string, token: string, code: string): string {
  return `${signLink(publicOrigin, token)}\n${code}`
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
      subject: "Sign in",
      text: mail.text,
    }),
  })
  if (!response.ok) {
    throw new Error("resend refused the message")
  }
}
