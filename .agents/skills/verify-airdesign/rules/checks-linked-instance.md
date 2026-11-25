# Linked components

## Linked instance

A quiet rebuild keeps part IDs, replays dependent edits in queue order and preserves undo and redo history. An instance ID and a semantic key determine each part ID. Doom reserves those IDs for generated nodes. A plain delete suppresses a part while the data still emits its key. When the key exits, the join reports the discarded suppression and override. The same row ID can return with fresh generated values and the same node ID.

The person and agent inverse paths both use `restoreInstance` when a later write has changed the instance. A part's suppression revision tracks the last change of that key's membership or suppression. An undo restores its own keys and preserves another writer's later change to the same key, even if they returned it to a value it held before. An empty guarded edit checks its base and creates no row.

Run `pnpm check:specs linked-instance`. The model interleaves data edits, each of two writers' part deletes, their undo, an input undo across another writer’s part delete, a run undo that goes stale while in flight or meets a later data writer, and redo after a rebuild. It bounds history to one delete per writer and one redo. The state graph explores two row keys and their orders. For the capacity invariant, an expired key represents a generation of 100 retired suppressions against the 301-part maximum chart. The full-size unit test turns over real row IDs and exercises the 499-record limit.

`tests/linked-instance-replay.test.ts` checks each model edge through the device queue, Doom's inverses and a shared remote. It also checks stale empty edits, both delete orders, a dependent fill after update and an input undo across a later suppression. `KeepExpired` and `WholeInstanceUndo` reproduce round-two failures. `ClearRedo` reproduces the earlier loss of redo on rebuild. `DropUpdateOnSuppression` reproduces the lost data undo, and `DropStaleRunUndo` reproduces the dropped run undo from round three. `StaleRunRead` models a run undo computed before a later data edit and committed without rereading it. Either undo overwriting the later data violates the invariant. The replay uses the device queue. The API test exercises the lock with concurrent Postgres writes.

## Linked turn reload

Run `pnpm check:specs linked-turn-reload`. The model holds one queued undo or redo and one later edit. Reload keeps the persisted queue and its linked turn intent. Reconnect restores any input still owned by the turn and keeps the later writer's input or suppression. The model checks data, variant and tokens individually. Turning off `PersistIntent` reproduces the round-four loss after reload. Turning on `ClobberLater` violates the later-writer invariant.

`tests/linked-turn-reload-replay.test.ts` drives the queued cases through the device and remote. The model and its replay assume the device hands back the fold and the queue it was given. `packages/live/src/fold-rows.test.ts` checks that at the device: a row set that does not add up to its head is no copy, and the queue is still read. The linked offline undo journey deletes Beta via the editor, undoes it offline, reloads, deletes Alpha from another device and checks the saved deck after reconnect.

## Linked run order

Run `pnpm check:specs linked-run-order`. The model bounds history to two rows and two runs. Redo keeps a fill the run wrote explicitly. Undo of a row removal restores the returning row’s override. Undo of the older run still works after undo of the newer run restores the older data. The constants `DropRedoFill`, `DropReturnedOverride` and `IgnoreOwnedRevs` remove each behavior in turn.

`tests/linked-run-order-replay.test.ts` drives each transition through the editor queue and Doom. `apps/api/src/mcp-undo-linked-instance.test.ts` also checks consecutive run undo through MCP and Postgres.
