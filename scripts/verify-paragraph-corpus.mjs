import {corpusCoverage} from "../packages/pptx/test/corpus/coverage.ts"

const results = await corpusCoverage()
for (const result of results) process.stdout.write(JSON.stringify(result) + "\n")
if (results.some(result => !result.pass)) process.exitCode = 1
