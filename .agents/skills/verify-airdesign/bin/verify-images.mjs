import { readFileSync } from "node:fs"
import path from "node:path"

export const verifyImageHost = "images.verify.test"

const fixtureAddress = { address: "93.184.216.34", family: 4 }

function fixtureAnswer(repo, url) {
  let body = new Uint8Array()
  let status = 404
  try {
    body = new Uint8Array(readFileSync(path.join(repo, "scripts/pptx-fixtures", path.basename(url.pathname))))
    status = 200
  } catch {
    status = 404
  }
  return {
    status,
    location: undefined,
    length: body.byteLength,
    body: (async function* () {
      yield body
    })(),
    cancel: () => {},
  }
}

export function verifyImages(repo, net) {
  return {
    resolve: (host) => (host === verifyImageHost ? Promise.resolve([fixtureAddress]) : net.resolve(host)),
    get: (url, at, signal) =>
      url.hostname === verifyImageHost ? Promise.resolve(fixtureAnswer(repo, url)) : net.get(url, at, signal),
  }
}
