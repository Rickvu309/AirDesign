import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })

async function ask(page: Page, text: string) {
  await page.locator("[data-editor-panel]").getByRole("textbox", { name: "Ask Aira" }).fill(text)
  await page.keyboard.press("Enter")
}

test("the chat a person picked from history reopens after a reload, and an empty chat adds no entry", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.goto("/s")
  await page.locator("[data-editor-ready]").waitFor()
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const newChat = side.getByRole("button", { name: "New chat", exact: true })
  stack.aira({ name: "turn.sse" }, { name: "turn.sse" })
  await ask(page, "First chat question")
  await expect(log.getByText("First chat question", { exact: true })).toBeVisible()
  await newChat.click()
  await expect(newChat).toBeDisabled()
  await ask(page, "Second chat question")
  await expect(log.getByText("Second chat question", { exact: true })).toBeVisible()
  await newChat.click()
  await side.getByRole("button", { name: airaCopy.chatsTitle, exact: true }).click()
  const chats = page.locator("[data-aira-chats]").getByRole("menuitemradio")
  await expect(chats).toHaveCount(2)
  await chats.filter({ hasText: "First chat question" }).click()
  await expect(log.getByText("First chat question", { exact: true })).toBeVisible()

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(log.getByText("First chat question", { exact: true })).toBeVisible()
  await expect(log.getByText("Second chat question", { exact: true })).toHaveCount(0)
  await side.getByRole("button", { name: /chat history/ }).click()
  await expect(chats).toHaveCount(2)
})
