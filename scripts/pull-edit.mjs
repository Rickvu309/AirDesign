import { succeeds } from "./land-git.mjs"

export const pullEdits = ({ pull, title, body }) => ({
  ...(pull.baseRefName === "main" ? {} : { base: "main" }),
  ...(title === undefined || title === pull.title ? {} : { title }),
  ...(body === undefined || body === pull.body ? {} : { body }),
})

export const editPull = ({ gh, repository, number, fields }) =>
  succeeds(
    gh(["api", "-X", "PATCH", `repos/${repository}/pulls/${number}`, "--input", "-"], JSON.stringify(fields)),
    `could not edit pull request ${number}`,
  )

export const editLines = (number, fields) => [
  `pull request ${number}: new ${Object.keys(fields).join(", ")}`,
  ...("body" in fields
    ? ["a new body starts the bar check again and cancels a bar run in progress; the new run judges it"]
    : []),
]
