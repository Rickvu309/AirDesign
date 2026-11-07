import {mkdir,writeFile} from "node:fs/promises"
import {createBuildIdentity} from "./build-identity.ts"
const identity=createBuildIdentity()
await mkdir(new URL("../../build/",import.meta.url),{recursive:true})
await writeFile(new URL("../../build/version.json",import.meta.url),JSON.stringify(identity)+"\n")
