import noComments from "./rules/no-comments.js"
import noBareTest from "./rules/no-bare-test.js"
import noBlindWait from "./rules/no-blind-wait.js"
import noByteCounter from "./rules/no-byte-counter.js"
import noElementIdCast from "./rules/no-element-id-cast.js"
import noKeyWhileComposing from "./rules/no-key-while-composing.js"
import noEnvOutsideEntry from "./rules/no-env-outside-entry.js"
import noFieldEdge from "./rules/no-field-edge.js"
import noHiddenInput from "./rules/no-hidden-input.js"
import noHttpOutsideServer from "./rules/no-http-outside-server.js"
import noLimitInCopy from "./rules/no-limit-in-copy.js"
import noRaw from "./rules/no-raw.js"
import noRouteLiteral from "./rules/no-route-literal.js"
import noRunLiteral from "./rules/no-run-literal.js"
import noStampLiteral from "./rules/no-stamp-literal.js"
import noXmlSearch from "./rules/no-xml-search.js"

const plugin = {
  meta: { name: "airdesign" },
  rules: {
    "no-bare-test": noBareTest,
    "no-blind-wait": noBlindWait,
    "no-comments": noComments,
    "no-byte-counter": noByteCounter,
    "no-element-id-cast": noElementIdCast,
    "no-key-while-composing": noKeyWhileComposing,
    "no-env-outside-entry": noEnvOutsideEntry,
    "no-field-edge": noFieldEdge,
    "no-hidden-input": noHiddenInput,
    "no-http-outside-server": noHttpOutsideServer,
    "no-limit-in-copy": noLimitInCopy,
    "no-raw": noRaw,
    "no-route-literal": noRouteLiteral,
    "no-run-literal": noRunLiteral,
    "no-stamp-literal": noStampLiteral,
    "no-xml-search": noXmlSearch,
  },
}

export default plugin
