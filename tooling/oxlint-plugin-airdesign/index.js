import noComments from "./rules/no-comments.js"
import noRaw from "./rules/no-raw.js"
import noXmlSearch from "./rules/no-xml-search.js"

const plugin = {
  meta: { name: "airdesign" },
  rules: {
    "no-comments": noComments,
    "no-raw": noRaw,
    "no-xml-search": noXmlSearch,
  },
}

export default plugin
