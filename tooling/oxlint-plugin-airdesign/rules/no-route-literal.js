export const routePaths = [
  "/decks/open",
  "/decks/commit",
  "/decks/index",
  "/decks/watch",
  "/decks/list",
  "/decks/rename",
  "/decks/trash",
  "/decks/restore",
  "/decks/delete",
  "/decks/original/upload",
  "/decks/original/done",
  "/decks/original",
  "/decks/undo",
  "/sign-in/email",
  "/sign-in/code",
  "/sign-in/link",
  "/oauth/client",
  "/oauth/approve",
  "/oauth/register",
  "/oauth/token",
  "/oauth/revoke",
]

const routeFamilies = ["/decks", "/oauth"]

const message =
  "Take an API path from deckRoutes, signInRoutes or oauthRoutes in @airdesign/catalog, never spell it by hand."

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const skipped = (filename) =>
  /\.(test|spec|proof)\.[cm]?[jt]sx?$/.test(filename) ||
  filename.includes("/packages/catalog/") ||
  filename.endsWith("/scripts/smoke.mjs") ||
  filename.includes("/tooling/oxlint-plugin-airdesign/")

const stringValue = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined)

const startsRoute = (text) =>
  routeFamilies.some((family) => text === family || text.startsWith(`${family}/`)) ||
  routePaths.some((route) => text.startsWith(route))

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject an API path spelled by hand outside packages/catalog.",
    },
  },
  create(context) {
    if (skipped(filenameOf(context))) return {}
    return {
      Literal(node) {
        if (routePaths.includes(stringValue(node))) context.report({ node, message })
      },
      TemplateLiteral(node) {
        if (node.quasis.some((quasi) => startsRoute(quasi.value.cooked ?? quasi.value.raw))) {
          context.report({ node, message })
        }
      },
      BinaryExpression(node) {
        if (node.operator !== "+") return
        const parts = [stringValue(node.left), stringValue(node.right)]
        if (parts.some((part) => part !== undefined && !routePaths.includes(part) && startsRoute(part))) {
          context.report({ node, message })
        }
      },
    }
  },
}

export default rule
