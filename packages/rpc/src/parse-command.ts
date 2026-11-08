import {parseChangeSet} from "../../deck/src/index.ts"
import {parseNativeChangeSet} from "../../deck/src/text/operations.ts"
import {decodeCommand} from "../../change-log/src/command-codec.ts"
export function parseCommand(value: unknown) { return decodeCommand(value, parseChangeSet) }
export function parseNativeCommandV3(value: unknown) {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 3 || !("command" in value)) throw new Error("invalid-native-command-v3")
  return decodeCommand(value.command, parseNativeChangeSet)
}
