import noComments from "./rules/no-comments.js"
import noByteCounter from "./rules/no-byte-counter.js"
import noElementIdCast from "./rules/no-element-id-cast.js"
import noEnvOutsideEntry from "./rules/no-env-outside-entry.js"
import noHiddenInput from "./rules/no-hidden-input.js"
import noHttpOutsideServer from "./rules/no-http-outside-server.js"
import noRaw from "./rules/no-raw.js"
import noRouteLiteral from "./rules/no-route-literal.js"
import noRunLiteral from "./rules/no-run-literal.js"
import noXmlSearch from "./rules/no-xml-search.js"

const plugin = {
  meta: { name: "airdesign" },
  rules: {
    "no-comments": noComments,
    "no-byte-counter": noByteCounter,
    "no-element-id-cast": noElementIdCast,
    "no-env-outside-entry": noEnvOutsideEntry,
    "no-hidden-input": noHiddenInput,
    "no-http-outside-server": noHttpOutsideServer,
    "no-raw": noRaw,
    "no-route-literal": noRouteLiteral,
    "no-run-literal": noRunLiteral,
    "no-xml-search": noXmlSearch,
  },
}

export default plugin
