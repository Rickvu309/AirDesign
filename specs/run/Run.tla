---- MODULE Run ----
\* A run starts, stops, hits a limit, and resumes. A later run may start once that run has stopped or been undone.
\* A read lands only when its run id is the one stored on the node.
\* This model keeps one write, so a later run lands a row only if the earlier run landed none.
EXTENDS Integers

VARIABLES
  phase,
  runId,
  writes,
  readAt,
  mark,
  didRead,
  seen,
  seenId,
  seenGen,
  opened,
  landed,
  owner,
  generation,
  ownedGen,
  foreign,
  startedLive,
  liveId,
  earlierLive

ghost == <<startedLive, liveId, earlierLive>>

vars == <<phase, runId, writes, readAt, mark, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, foreign, ghost>>

\* The one row counts once when it lands and once more when an undo hides it. The number never falls.
Version == writes + IF landed = 1 /\ writes = 0 THEN 2 ELSE 0

\* The offered id has to equal the id stored on the node. The letter s is not special.
accepted(readId) == readId = runId /\ phase \in {"stopped", "undone"}

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ runId \in {"none", "s", "t"}
  /\ writes \in {0, 1}
  /\ readAt \in {-1, 0, 1, 2}
  /\ mark \in {-1, 0, 1, 2}
  /\ didRead \in BOOLEAN
  /\ seen \in {"none", "stopped", "undone"}
  /\ seenId \in {"none", "s", "t"}
  /\ seenGen \in {-1, 0, 1, 2}
  /\ opened \in BOOLEAN
  /\ landed \in {0, 1}
  /\ owner \in {"none", "s", "t"}
  /\ generation \in {0, 1, 2}
  /\ ownedGen \in {-1, 0, 1, 2}
  /\ foreign \in {0, 1}
  /\ startedLive \in BOOLEAN
  /\ liveId \in {"none", "s", "t"}
  /\ earlierLive \in BOOLEAN

Init ==
  /\ phase = "idle"
  /\ runId = "none"
  /\ writes = 0
  /\ readAt = -1
  /\ mark = -1
  /\ didRead = FALSE
  /\ seen = "none"
  /\ seenId = "none"
  /\ seenGen = -1
  /\ opened = FALSE
  /\ landed = 0
  /\ owner = "none"
  /\ generation = 0
  /\ ownedGen = -1
  /\ foreign = 0
  /\ startedLive = FALSE
  /\ liveId = "none"
  /\ earlierLive = FALSE

\* The first start applies while the node is idle, and it stores the offered run id.
Start ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ runId' \in {"s", "t"}
  /\ readAt' = Version
  /\ opened' = TRUE
  /\ generation' = generation + 1
  /\ startedLive' = (startedLive \/ phase = "running")
  /\ liveId' = runId'
  /\ UNCHANGED <<writes, mark, didRead, seen, seenId, seenGen, landed, owner, ownedGen, foreign, earlierLive>>

\* A start during a live run is refused and does not replace the stored id.
StartAgain ==
  /\ phase = "running"
  /\ UNCHANGED vars

\* A start from a stopped or undone run stores a new id. An id that already owns a row is not offered here.
StartNext ==
  /\ phase \in {"stopped", "undone"}
  /\ generation < 2
  /\ runId' \in {"s", "t"}
  /\ (runId' # owner \/ owner = "none")
  /\ phase' = "running"
  /\ readAt' = Version
  /\ mark' = -1
  /\ generation' = generation + 1
  /\ foreign' = IF (writes = 1 /\ owner # "none" /\ owner # runId') THEN 1 ELSE foreign
  /\ startedLive' = (startedLive \/ phase = "running")
  /\ liveId' = runId'
  /\ UNCHANGED <<writes, didRead, seen, seenId, seenGen, opened, landed, owner, ownedGen, earlierLive>>

\* A start that names an id which already has a row stays fenced.
StartReuse ==
  /\ phase \in {"stopped", "undone"}
  /\ landed = 1
  /\ owner \in {"s", "t"}
  /\ UNCHANGED vars

\* A fresh run with no row yet may land one write. A stopped or undone run does not accept a write.
AgentWrites ==
  \/ /\ phase = "running"
     /\ owner = "none"
     /\ readAt = Version
     /\ writes = 0
     /\ writes' = 1
     /\ landed' = 1
     /\ owner' = runId
     /\ ownedGen' = generation
     /\ UNCHANGED <<phase, runId, readAt, mark, didRead, seen, seenId, seenGen, opened, generation, foreign, ghost>>
  \/ /\ phase \in {"stopped", "undone"}
     /\ UNCHANGED vars

\* A write that names the other id does not land and does not replace the stored id.
AgentMiss ==
  /\ phase = "running"
  /\ UNCHANGED vars

\* Stop freezes the deck. Writes already landed stay.
Stop ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ mark' = Version
  /\ UNCHANGED <<runId, writes, readAt, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, foreign, ghost>>

\* Stop applies only while the stored id is running.
StopMiss ==
  /\ phase = "running"
  /\ UNCHANGED vars

\* A limit ends the run the way stop does.
Limit ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ mark' = Version
  /\ UNCHANGED <<runId, writes, readAt, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, foreign, ghost>>

\* Resume continues the same run. It does not start a second run on the deck.
Resume ==
  /\ phase = "stopped"
  /\ phase' = "running"
  /\ UNCHANGED <<runId, writes, readAt, mark, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, foreign, ghost>>

\* Undo of the current run hides that run's write and leaves an earlier run's write visible.
Undo ==
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ writes' = IF owner = runId THEN 0 ELSE writes
  /\ UNCHANGED <<runId, readAt, mark, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, foreign, ghost>>

\* Undo of an earlier run, while the later run is stopped or undone, hides only the earlier row.
UndoEarlier ==
  /\ phase \in {"stopped", "undone"}
  /\ owner \in {"s", "t"}
  /\ owner # runId
  /\ writes = 1
  /\ writes' = 0
  /\ foreign' = 0
  /\ earlierLive' = (earlierLive \/ phase = "running")
  /\ UNCHANGED <<phase, runId, readAt, mark, didRead, seen, seenId, seenGen, opened, landed, owner, generation, ownedGen, startedLive, liveId>>

\* Undo of an earlier run stays fenced while a run is live.
UndoEarlierLive ==
  /\ phase = "running"
  /\ owner \in {"s", "t"}
  /\ owner # runId
  /\ UNCHANGED vars

\* A second undo of an earlier run whose row is already hidden removes nothing.
UndoEarlierAgain ==
  /\ phase \in {"stopped", "undone"}
  /\ owner \in {"s", "t"}
  /\ owner # runId
  /\ landed = 1
  /\ writes = 0
  /\ UNCHANGED vars

ReadS ==
  \/ /\ accepted("s")
     /\ didRead = FALSE
     /\ didRead' = TRUE
     /\ seen' = phase
     /\ seenId' = "s"
     /\ seenGen' = generation
     /\ UNCHANGED <<phase, runId, writes, readAt, mark, opened, landed, owner, generation, ownedGen, foreign, ghost>>
  \/ /\ ~accepted("s")
     /\ UNCHANGED vars

ReadT ==
  \/ /\ accepted("t")
     /\ didRead = FALSE
     /\ didRead' = TRUE
     /\ seen' = phase
     /\ seenId' = "t"
     /\ seenGen' = generation
     /\ UNCHANGED <<phase, runId, writes, readAt, mark, opened, landed, owner, generation, ownedGen, foreign, ghost>>
  \/ /\ ~accepted("t")
     /\ UNCHANGED vars

Next ==
  Start \/ StartAgain \/ StartNext \/ StartReuse \/ AgentWrites \/ AgentMiss \/ Stop \/ StopMiss \/ Limit \/ Resume \/ Undo \/ UndoEarlier \/ UndoEarlierLive \/ UndoEarlierAgain \/ ReadS \/ ReadT

Spec == Init /\ [][Next]_vars

\* A run that has not started has no writes.
UnstartedHasNoWrites ==
  phase = "idle" => writes = 0 /\ landed = 0 /\ runId = "none" /\ opened = FALSE /\ didRead = FALSE

\* Stop freezes the visible rows. Undo of an earlier run may hide one afterwards, and it does not add a row.
StopFreezesLandedWrites ==
  phase # "stopped" \/ writes <= mark

\* A limit ends the run the way stop does.
LimitEndsLikeStop ==
  phase # "stopped" \/ (writes <= mark /\ runId \in {"s", "t"})

\* Resume continues the same run. It does not start a second run on that deck.
ResumeContinuesSameRun ==
  /\ (phase = "idle") = (opened = FALSE)
  /\ opened = FALSE => runId = "none" /\ landed = 0
  /\ opened = TRUE => runId \in {"s", "t"}

\* A stopped run does not grow its visible rows. An undone run shows none of its own rows.
StoppedOrEndedRejectsWrite ==
  /\ phase = "stopped" => writes <= mark
  /\ phase = "undone" => owner # runId \/ writes = 0

\* A read is stored only from a stopped or undone phase, and only for the run id stored then. A later run does not erase it.
ReadMatchesStoredRun ==
  /\ didRead => seen \in {"stopped", "undone"} /\ seenId \in {"s", "t"} /\ (generation = seenGen => seenId = runId)
  /\ didRead = FALSE => seen = "none" /\ seenId = "none" /\ seenGen = -1

\* A later start stores an id that does not already own a row.
LaterStartUsesAFreshId ==
  ownedGen = -1 \/ generation = ownedGen \/ runId # owner

\* A start is refused while a run is live. No start applies over a running run, and a live run keeps the id it started with.
StartRefusedWhileLive ==
  /\ startedLive = FALSE
  /\ phase # "running" \/ runId = liveId

\* Undo of an earlier run waits for the later run to end. It never applies while a run is live.
EarlierUndoWaitsForEnd == earlierLive = FALSE

\* Undo of the current run leaves another run's visible row in place.
UndoLeavesTheOtherRun ==
  foreign = 0 \/ writes = 1

====
