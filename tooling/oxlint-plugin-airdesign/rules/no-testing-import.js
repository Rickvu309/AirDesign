import { moduleVisitors } from "../module-reference.js"

const message =
  'A "testing" folder or a test file holds what tests import: move what product code needs out of the tests.'

const filenameOf = (context) => String(context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")

const isTest = (filename) => /\.(?:test|spec)\.[a-z]+$/u.test(filename) || /\/testing\//u.test(filename)

const inSourceTrees = /\/(?:apps|packages)\//u

const testFolder = /(?:^|\/)testing(?:\/|\?|$)/u
const testFile = /\.(?:test|spec)(?:\.[a-z]+)?(?:\?|$)/u
const testSupport = (source) => testFolder.test(source) || testFile.test(source)

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Reject a product file under apps/ or packages/ importing a testing folder or a test file.",
    },
  },
  create(context) {
    const filename = filenameOf(context)
    if (!inSourceTrees.test(filename) || isTest(filename)) return {}
    return moduleVisitors((node, source) => {
      if (source !== undefined && testSupport(source)) context.report({ node, message })
    })
  },
}

export default rule
