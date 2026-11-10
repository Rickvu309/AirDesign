const clockMessage = "Take the time as a `now` option, the way `ApiOptions.now` in apps/api/src/server.ts does."
const randomMessage = "Take randomness as an option, the way `ApiOptions.mint` in apps/api/src/server.ts does."
const folderMessage = "Take the folder as an option. A shared temp folder leaks between runs."

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const applies = (filename) => {
  if (filename.includes(".test.") || filename.includes(".spec.")) return false
  return /\/(?:packages|apps)\/[^/]+\/src\//u.test(filename)
}

const named = (node, name) => node?.type === "Identifier" && node.name === name

const member = (node, object, property) =>
  node?.type === "MemberExpression" &&
  node.computed !== true &&
  (object === undefined || named(node.object, object)) &&
  named(node.property, property)

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject reading the clock, randomness or the shared temp folder in product code.",
    },
  },
  create(context) {
    if (!applies(filenameOf(context))) return {}
    return {
      CallExpression(node) {
        if (member(node.callee, "Date", "now")) context.report({ node, message: clockMessage })
        if (member(node.callee, "Math", "random")) context.report({ node, message: randomMessage })
        if (member(node.callee, undefined, "tmpdir") || named(node.callee, "tmpdir")) {
          context.report({ node, message: folderMessage })
        }
      },
      NewExpression(node) {
        if (named(node.callee, "Date") && node.arguments.length === 0) context.report({ node, message: clockMessage })
      },
    }
  },
}

export default rule
