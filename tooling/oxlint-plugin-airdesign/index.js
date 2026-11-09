import noComments from "./rules/no-comments.js"

const plugin = {
  meta: { name: "airdesign" },
  rules: {
    "no-comments": noComments,
  },
}

export default plugin
