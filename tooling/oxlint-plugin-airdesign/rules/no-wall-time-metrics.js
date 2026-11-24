const message =
  'Read the page\'s engine metrics in thread time: send("Performance.enable", { timeDomain: "threadTicks" }). In wall time, a busy machine counts the time other processes hold the core as the page\'s work.'

const speedMessage =
  "Read a speed test's time in renderer thread time: a trace event's tdur, or TaskDuration after Performance.enable with timeDomain threadTicks. Date.now, performance.now, a pointer timeStamp, longtask and long-animation-frame include time other processes hold the CPU."

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const speedFiles = [
  "tests/browser/agent-paint.ts",
  "tests/browser/drag-feel.ts",
  "tests/browser/renderer-thread.ts",
  "tests/browser/typed-letter.ts",
  "tests/browser/editor-speed.spec.ts",
]

const wallEntryTypes = new Set(["longtask", "long-animation-frame"])

const speedFile = (context) => speedFiles.some((file) => filenameOf(context).endsWith(file))

const isNamed = (node, name) =>
  (node?.type === "Identifier" && node.name === name) ||
  (node?.type === "MemberExpression" && memberName(node) === name && isNamed(node.object, "window"))

const isClockNow = (node, object) => {
  const callee = node.callee
  return callee?.type === "MemberExpression" && memberName(callee) === "now" && isNamed(callee.object, object)
}

const isWallClock = (node) => isClockNow(node, "performance") || isClockNow(node, "Date")

const propertyName = (node) =>
  node?.type === "Identifier" ? node.name : node?.type === "Literal" ? String(node.value) : undefined

const memberName = (node) => (node.computed ? stringOf(node.property) : propertyName(node.property))

const stringOf = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked
  return undefined
}

const inThreadTime = (options) =>
  options?.type === "ObjectExpression" &&
  options.properties.some(
    (property) =>
      property.type === "Property" &&
      propertyName(property.key) === "timeDomain" &&
      stringOf(property.value) === "threadTicks",
  )

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Refuse Performance.enable over the DevTools protocol unless it reads metrics in thread time.",
    },
  },
  create(context) {
    const speed = speedFile(context)
    return {
      CallExpression(node) {
        const callee = node.callee
        if (speed && isWallClock(node)) context.report({ node, message: speedMessage })
        if (callee.type !== "MemberExpression" || callee.computed || propertyName(callee.property) !== "send") return
        if (stringOf(node.arguments[0]) !== "Performance.enable") return
        if (!inThreadTime(node.arguments[1])) context.report({ node, message })
      },
      MemberExpression(node) {
        if (speed && memberName(node) === "timeStamp" && !isNamed(node.object, "console"))
          context.report({ node, message: speedMessage })
      },
      Literal(node) {
        if (speed && wallEntryTypes.has(stringOf(node))) context.report({ node, message: speedMessage })
      },
      TemplateLiteral(node) {
        if (speed && wallEntryTypes.has(stringOf(node))) context.report({ node, message: speedMessage })
      },
    }
  },
}

export default rule
