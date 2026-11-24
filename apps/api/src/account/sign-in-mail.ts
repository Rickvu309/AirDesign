import { mailDark, mailLight, mailRadius } from "./sign-in-mail-art.js"

export type SignInMailInput = { readonly link: string; readonly code: string; readonly minutes: number }
export type SignInMail = { readonly subject: string; readonly text: string; readonly html: string }

const english = new Intl.PluralRules("en")

const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const mono = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
const codeSpacing = 8

const copy = {
  subject: "Sign in to AirDesign",
  heading: "Your sign-in code",
  textHeading: "Your AirDesign sign-in code:",
  where: "Enter this code where you asked to sign in.",
  textWhere: "Enter this code where you asked to sign in, or open this link:",
  or: "or",
  button: "Sign in to AirDesign",
  fallback: "If the button doesn't work, open this link:",
  ignore: "If you didn't ask to sign in, ignore this email. No one can sign in without this code or link.",
  wordmark: "AirDesign",
  codeLabel: (spoken: string) => `Sign-in code: ${spoken}`,
  expiry: (minutes: number) =>
    english.select(minutes) === "one"
      ? `The code and link work once and expire in ${String(minutes)} minute.`
      : `The code and link work once and expire in ${String(minutes)} minutes.`,
  preheader: (minutes: number) =>
    english.select(minutes) === "one"
      ? `Use the code or link inside. Both expire in ${String(minutes)} minute.`
      : `Use the code or link inside. Both expire in ${String(minutes)} minutes.`,
} as const

function escaped(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function signInText({ link, code, minutes }: SignInMailInput): string {
  return [copy.textHeading, "", code, "", copy.textWhere, "", link, "", copy.expiry(minutes), "", copy.ignore, ""].join(
    "\n",
  )
}

const darkStyle = `
      .page { background-color: ${mailDark.page} !important; }
      .card { background-color: ${mailDark.card} !important; border-color: ${mailDark.edge} !important; }
      .rule { border-color: ${mailDark.edge} !important; }
      .ink { color: ${mailDark.text} !important; }
      .quiet { color: ${mailDark.quiet} !important; }
      .code-box { background-color: ${mailDark.codeFill} !important; border-color: ${mailDark.codeEdge} !important; }
      .link { color: ${mailDark.link} !important; }`

function signInHtml({ link, code, minutes }: SignInMailInput): string {
  const href = escaped(link)
  const spoken = escaped(code.split("").join(" "))
  const body = `font-family: ${sans}; font-size: 15px; line-height: 22px;`
  const small = `font-family: ${sans}; font-size: 13px; line-height: 20px; color: ${mailLight.quiet};`
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escaped(copy.subject)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; }
      a { text-decoration: none; }
      @media (max-width: 480px) {
        .shell { padding: 24px 12px !important; }
        .card { padding: 28px 20px !important; }
      }
      @media (prefers-color-scheme: dark) {${darkStyle}
      }
    </style>
  </head>
  <body class="page" style="margin: 0; padding: 0; background-color: ${mailLight.page};">
    <div style="display: none; max-height: 0; max-width: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px; mso-hide: all;">${escaped(copy.preheader(minutes))}${"&zwnj;&nbsp;".repeat(40)}</div>
    <table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${mailLight.page};">
      <tr>
        <td class="shell" align="center" style="padding: 40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px;">
            <tr>
              <td class="ink" style="padding: 0 4px 20px; font-family: ${sans}; font-size: 17px; line-height: 24px; font-weight: 700; letter-spacing: -0.2px; color: ${mailLight.text};">${copy.wordmark}</td>
            </tr>
            <tr>
              <td class="card" style="padding: 40px; background-color: ${mailLight.card}; border: 1px solid ${mailLight.edge}; border-radius: ${String(mailRadius.card)}px;">
                <h1 class="ink" style="margin: 0; font-family: ${sans}; font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -0.3px; color: ${mailLight.text};">${copy.heading}</h1>
                <p class="quiet" style="margin: 8px 0 0; ${body} color: ${mailLight.quiet};">${copy.where}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                  <tr>
                    <td class="code-box" align="center" style="padding: 18px 8px; background-color: ${mailLight.codeFill}; border: 1px solid ${mailLight.codeEdge}; border-radius: ${String(mailRadius.code)}px;">
                      <div class="ink" style="padding-left: ${String(codeSpacing)}px; font-family: ${mono}; font-size: 32px; line-height: 40px; font-weight: 600; letter-spacing: ${String(codeSpacing)}px; color: ${mailLight.text};" role="img" aria-label="${escaped(copy.codeLabel(spoken))}">${escaped(code)}</div>
                    </td>
                  </tr>
                </table>
                <p class="quiet" style="margin: 16px 0; ${small} text-align: center;">${copy.or}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="${mailLight.button}" style="background-color: ${mailLight.button}; border-radius: ${String(mailRadius.button)}px;">
                      <a href="${href}" target="_blank" style="display: block; padding: 12px 20px; font-family: ${sans}; font-size: 15px; line-height: 20px; font-weight: 600; color: ${mailLight.buttonText}; text-decoration: none; border-radius: ${String(mailRadius.button)}px;">${copy.button}</a>
                    </td>
                  </tr>
                </table>
                <p class="quiet" style="margin: 16px 0 0; ${small}">${copy.fallback}<br><a class="link" href="${href}" target="_blank" style="color: ${mailLight.link}; text-decoration: underline; word-break: break-all;">${href}</a></p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                  <tr>
                    <td class="rule" style="padding-top: 20px; border-top: 1px solid ${mailLight.edge};">
                      <p class="quiet" style="margin: 0; ${small}">${escaped(copy.expiry(minutes))}</p>
                      <p class="quiet" style="margin: 8px 0 0; ${small}">${escaped(copy.ignore)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

export function signInMail(input: SignInMailInput): SignInMail {
  return { subject: copy.subject, text: signInText(input), html: signInHtml(input) }
}
