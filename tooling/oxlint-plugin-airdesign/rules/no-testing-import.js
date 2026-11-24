import { moduleVisitors } from "../module-reference.js"

const message =
  'A "testing" folder holds what tests import: keep this reference in a test file, or move what product code needs out of testing.'

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const isTest = (filename) => /\.(?:test|spec)\.[a-z]+$/u.test(filename) || /\/testing\//u.test(filename)

const inSourceTrees = /\/(?:apps|packages)\//u

const testSupport = /(?:^|\/)testing\//u

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject a product file under apps/ or packages/ importing a testing path.",
    },
  },
  create(context) {
    const filename = filenameOf(context)
    if (!inSourceTrees.test(filename) || isTest(filename)) return {}
    return moduleVisitors((node, source) => {
      if (source !== undefined && testSupport.test(source)) context.report({ node, message })
    })
  },
}

export default rule
