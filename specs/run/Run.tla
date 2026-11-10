---- MODULE Run ----
\* One run starts, stops, hits a limit, and resumes on one deck.
\* A read lands only when its run id is the one stored on the node.
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
  opened,
  landed

vars == <<phase, runId, writes, readAt, mark, didRead, seen, seenId, opened, landed>>

\* The offered id has to equal the id stored on the node. The letter s is not special.
accepted(readId) == readId = runId /\ phase \in {"stopped", "undone"}

TypeOK ==
  /\ phase \in {"idle", "running", "stopped", "undone"}
  /\ runId \in {"none", "s", "t"}
  /\ writes \in {0, 1}
  /\ readAt \in {-1, 0, 1}
  /\ mark \in {-1, 0, 1}
  /\ didRead \in BOOLEAN
  /\ seen \in {"none", "stopped", "undone"}
  /\ seenId \in {"none", "s", "t"}
  /\ opened \in BOOLEAN
  /\ landed \in {0, 1}

Init ==
  /\ phase = "idle"
  /\ runId = "none"
  /\ writes = 0
  /\ readAt = -1
  /\ mark = -1
  /\ didRead = FALSE
  /\ seen = "none"
  /\ seenId = "none"
  /\ opened = FALSE
  /\ landed = 0

\* Start applies only while the node is idle, and it stores the offered run id.
Start ==
  /\ phase = "idle"
  /\ phase' = "running"
  /\ runId' \in {"s", "t"}
  /\ readAt' = writes
  /\ opened' = TRUE
  /\ UNCHANGED <<writes, mark, didRead, seen, seenId, landed>>

\* A later start is refused and does not replace the stored id.
StartAgain ==
  /\ phase # "idle"
  /\ UNCHANGED vars

\* The write applies only while the stored id is running and readAt equals the current version.
\* A stopped or ended run does not accept another write from that run.
AgentWrites ==
  \/ /\ phase = "running"
     /\ readAt = writes
     /\ writes = 0
     /\ writes' = 1
     /\ landed' = 1
     /\ UNCHANGED <<phase, runId, readAt, mark, didRead, seen, seenId, opened>>
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
  /\ mark' = writes
  /\ UNCHANGED <<runId, writes, readAt, didRead, seen, seenId, opened, landed>>

\* Stop applies only while the stored id is running.
StopMiss ==
  /\ phase = "running"
  /\ UNCHANGED vars

\* A limit ends the run the way stop does.
Limit ==
  /\ phase = "running"
  /\ phase' = "stopped"
  /\ mark' = writes
  /\ UNCHANGED <<runId, writes, readAt, didRead, seen, seenId, opened, landed>>

\* Resume continues the same run. It does not start a second run on the deck.
Resume ==
  /\ phase = "stopped"
  /\ phase' = "running"
  /\ UNCHANGED <<runId, writes, readAt, mark, didRead, seen, seenId, opened, landed>>

\* Undo reaches a phase a later read may accept. It keeps the landed write and hides it.
Undo ==
  /\ phase \in {"running", "stopped"}
  /\ phase' = "undone"
  /\ writes' = 0
  /\ UNCHANGED <<runId, readAt, mark, didRead, seen, seenId, opened, landed>>

ReadS ==
  \/ /\ accepted("s")
     /\ didRead = FALSE
     /\ didRead' = TRUE
     /\ seen' = phase
     /\ seenId' = "s"
     /\ UNCHANGED <<phase, runId, writes, readAt, mark, opened, landed>>
  \/ /\ ~accepted("s")
     /\ UNCHANGED vars

ReadT ==
  \/ /\ accepted("t")
     /\ didRead = FALSE
     /\ didRead' = TRUE
     /\ seen' = phase
     /\ seenId' = "t"
     /\ UNCHANGED <<phase, runId, writes, readAt, mark, opened, landed>>
  \/ /\ ~accepted("t")
     /\ UNCHANGED vars

Next ==
  Start \/ StartAgain \/ AgentWrites \/ AgentMiss \/ Stop \/ StopMiss \/ Limit \/ Resume \/ Undo \/ ReadS \/ ReadT

Spec == Init /\ [][Next]_vars

\* A run that has not started has no writes.
UnstartedHasNoWrites ==
  phase = "idle" => writes = 0 /\ landed = 0 /\ runId = "none" /\ opened = FALSE /\ didRead = FALSE

\* Stop freezes the deck against a later write from that run. Writes already landed stay.
StopFreezesLandedWrites ==
  phase # "stopped" \/ (writes = mark /\ writes = landed)

\* A limit ends the run the way stop does.
LimitEndsLikeStop ==
  phase # "stopped" \/ (writes = mark /\ writes = landed /\ runId \in {"s", "t"})

\* Resume continues the same run. It does not start a second run on that deck.
ResumeContinuesSameRun ==
  /\ (phase = "idle") = (opened = FALSE)
  /\ opened = FALSE => runId = "none" /\ landed = 0
  /\ opened = TRUE => runId \in {"s", "t"}

\* A stopped or ended run does not accept another write from that run.
StoppedOrEndedRejectsWrite ==
  /\ phase = "stopped" => writes = landed
  /\ phase = "undone" => writes = 0

\* A read is accepted only when its run id equals the run id stored on that node, and the phase is stopped or undone.
ReadMatchesStoredRun ==
  /\ didRead => seen \in {"stopped", "undone"} /\ seenId = runId /\ seenId \in {"s", "t"}
  /\ didRead = FALSE => seen = "none" /\ seenId = "none"

====
