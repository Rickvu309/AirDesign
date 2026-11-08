import {expect,it} from "vitest"
import {fixtureDeck} from "../../../deck/src/fixture.ts"
import {transduceLegacyHistory} from "../../../change-log/src/text/history-transducer.ts"
import {commandId,initialHistory} from "../../../change-log/src/index.ts"
import {parseCommand,parseNativeCommandV3} from "../../src/parse-command.ts"

it("requires explicit native command version and refuses body archives on the legacy decoder",()=>{
  const archive=transduceLegacyHistory({version:2,history:initialHistory(fixtureDeck(1)),immutable:{version:2,events:[],receipts:[]}})
  const command={id:commandId("native"),kind:"edit",base:0,run:null,changes:{changes:[{kind:"set",target:archive.history.deck.id,value:archive.history.deck}]}}
  expect(parseNativeCommandV3({version:3,command})).toEqual(command)
  expect(()=>parseCommand(command)).toThrow()
  expect(()=>parseNativeCommandV3(command)).toThrow()
  expect(()=>parseNativeCommandV3({version:2,command})).toThrow()
  const old={...command,changes:{changes:[{kind:"set",target:archive.history.deck.id,value:fixtureDeck(1)}]}}
  expect(parseCommand(old)).toEqual(old)
  expect(()=>parseNativeCommandV3({version:3,command:old})).toThrow()
})
