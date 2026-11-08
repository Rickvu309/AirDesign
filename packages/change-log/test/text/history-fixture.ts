import {decodeLegacyCommandV2} from "../../src/command-codec.ts"
import {commandId, execute, initialHistory, type Command, type ExecutionIdentity} from "../../src/index.ts"
import type {Deck} from "../../../deck/src/model.ts"
import type {LegacyHistoryArchiveV2} from "../../src/text/history-transducer.ts"

export function legacyTape(deck: Deck) {
  const archive: LegacyHistoryArchiveV2 = {version:2,history:initialHistory(deck),immutable:{version:2,events:[],receipts:[]}}
  function send(command: Command, identity: ExecutionIdentity = "run" in command && command.run !== null && (command.kind === "edit" || command.kind === "patch") ? {kind:"run",run:command.run} : {kind:"person"}) {
    const commandBytes = JSON.stringify(command,null,1), decoded = decodeLegacyCommandV2({version:2,command:JSON.parse(commandBytes)})
    const result = execute(archive.history,decoded,identity), receiptBytes = JSON.stringify(result.receipt,null,2)
    archive.immutable.receipts.push({id:command.id,payload:`identity-bound-${command.id}`,receiptBytes})
    if (result.receipt.kind === "applied") { archive.history=result.history; archive.immutable.events.push({seq:result.history.seq,commandBytes,receiptBytes,identity}) }
    return result.receipt
  }
  function patch(name: string, target: import("../../../deck/src/model.ts").Id, fields: import("../../src/index.ts").Node["fields"], run: string | null = null) { return send({id:commandId(name),kind:"patch",base:archive.history.seq,run,target,fields}) }
  return {archive,send,patch}
}
