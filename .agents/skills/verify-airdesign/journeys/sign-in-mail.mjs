import { expect } from "@playwright/test"

export default async function drive({ page, signIn, mail, capture, note }) {
  const { email } = await signIn()
  const sent = mail(email)
  expect(sent.subject).toBeTruthy()
  const code = sent.text.match(/\b\d{6}\b/)?.[0]
  expect(code).toMatch(/^\d{6}$/)
  await page.setContent(sent.html, { waitUntil: "load" })
  await expect(page.getByText(code)).toBeVisible()
  await page.emulateMedia({ colorScheme: "light" })
  await capture("mail-light")
  await page.emulateMedia({ colorScheme: "dark" })
  await capture("mail-dark")
  note(
    `the sign-in mail "${sent.subject}" carries a text part and an HTML part; the HTML shows the code, captured light and dark`,
  )
}
