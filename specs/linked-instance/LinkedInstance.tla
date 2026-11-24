---- MODULE LinkedInstance ----
EXTENDS Integers, FiniteSets

CONSTANTS KeepExpired, WholeInstanceUndo, ClearRedo, DropUpdateOnSuppression, DropStaleRunUndo, StaleRunRead
VARIABLES rows, hidden, person, agent, redo, queued, other, badUndo, badRedo, rebuilt,
          mode, update, raced, badUpdate, badRun
vars == <<rows, hidden, person, agent, redo, queued, other, badUndo, badRedo, rebuilt,
          mode, update, raced, badUpdate, badRun>>
updateVars == <<mode, update, raced, badUpdate, badRun>>
suppressionVars == <<person, agent, redo, queued, other, badUndo, badRedo, rebuilt>>

Data == {"ab", "ba", "a", "b", ""}
Keys == 1..2
Present(d, k) == IF k = 1 THEN d \in {"ab", "ba", "a"} ELSE d \in {"ab", "ba", "b"}
Member(bits, k) == (bits \div (2 ^ (k - 1))) % 2 = 1
Put(bits, k) == IF Member(bits, k) THEN bits ELSE bits + 2 ^ (k - 1)
Drop(bits, k) == IF Member(bits, k) THEN bits - 2 ^ (k - 1) ELSE bits

\* 0 is unused, 1 and 2 own the last write to a key, 3 and 4
\* remember the same key after losing ownership, and 5 is consumed.
KeyOf(slot) == IF slot > 2 THEN slot - 2 ELSE slot
Lose(slot, k) == IF slot = k THEN slot + 2 ELSE slot
LoseExited(slot, d) == IF slot \in Keys /\ ~Present(d, slot) THEN slot + 2 ELSE slot
Owns(slot) == slot \in Keys
Pending(slot) == slot \in 1..4

Init ==
  /\ rows = "ab" /\ hidden = 0 /\ person = 0 /\ agent = 0 /\ redo = 0
  /\ queued = FALSE /\ other = FALSE /\ badUndo = FALSE /\ badRedo = FALSE
  /\ rebuilt = FALSE
  /\ mode \in {"suppression", "person", "run"}
  /\ update = "none" /\ raced = FALSE /\ badUpdate = FALSE /\ badRun = FALSE

\* The reduced budget counts all generated parts through their per-row cost.
\* 301 is the full 100-row case. A suppression of a live part replaces it.
Size(d, h) ==
  LET absent == {k \in Keys : ~Present(d, k) /\ Member(h, k)}
  IN 301 + 100 * Cardinality(absent)

Update(d, rebuilding) ==
  /\ mode = "suppression" /\ UNCHANGED updateVars
  /\ rows # d /\ Size(rows, hidden) <= 499
  /\ rows' = d /\ queued' = FALSE
  /\ hidden' = IF KeepExpired THEN hidden ELSE
       (IF Present(d, 1) THEN hidden % 2 ELSE 0) +
       (IF Present(d, 2) THEN hidden - (hidden % 2) ELSE 0)
  /\ person' = LoseExited(person, d)
  /\ agent' = LoseExited(agent, d)
  /\ redo' = IF rebuilding /\ ClearRedo THEN 0 ELSE LoseExited(redo, d)
  /\ badRedo' = (badRedo \/ (rebuilding /\ Owns(redo) /\ redo' # redo))
  /\ other' = (Pending(agent))
  /\ rebuilt' = (rebuilt \/ rebuilding)
  /\ UNCHANGED badUndo

DataUpdate ==
  \E d \in Data : Update(d, FALSE)

Delete(k, byPerson) ==
  /\ mode = "suppression" /\ UNCHANGED updateVars
  /\ Present(rows, k) /\ ~Member(hidden, k)
  /\ (IF byPerson THEN person = 0 ELSE agent = 0)
  /\ hidden' = Put(hidden, k) /\ queued' = FALSE
  /\ person' = IF byPerson THEN k ELSE Lose(person, k)
  /\ agent' = IF byPerson THEN Lose(agent, k) ELSE k
  /\ redo' = IF byPerson THEN 0 ELSE Lose(redo, k)
  /\ other' = (byPerson /\ Pending(agent))
  /\ UNCHANGED <<rows, badUndo, badRedo, rebuilt>>

PersonDelete == \E k \in Keys : Delete(k, TRUE)
AgentDelete == \E k \in Keys : Delete(k, FALSE)

PersonUndo ==
  /\ mode = "suppression" /\ UNCHANGED updateVars
  /\ Pending(person)
  /\ LET k == KeyOf(person)
         restores == Owns(person)
     IN /\ hidden' = IF restores THEN Drop(hidden, k) ELSE hidden
        /\ redo' = IF restores THEN k ELSE 0
        /\ queued' = restores
        /\ badUndo' = (badUndo \/ (Owns(person) # (~Member(hidden', k) /\ Member(hidden, k))))
  /\ person' = 5
  /\ agent' = IF Owns(person) THEN Lose(agent, person) ELSE agent
  /\ other' = (other \/ (Owns(person) /\ Pending(agent)))
  /\ UNCHANGED <<rows, badRedo, rebuilt>>

AgentUndo ==
  /\ mode = "suppression" /\ UNCHANGED updateVars
  /\ Pending(agent)
  /\ LET k == KeyOf(agent)
         restores == Owns(agent) /\ ~(WholeInstanceUndo /\ other)
     IN /\ hidden' = IF restores THEN Drop(hidden, k) ELSE hidden
        /\ badUndo' = (badUndo \/ (Owns(agent) # (~Member(hidden', k) /\ Member(hidden, k))))
        /\ person' = IF restores THEN Lose(person, k) ELSE person
        /\ redo' = IF restores THEN Lose(redo, k) ELSE redo
  /\ agent' = 5 /\ queued' = FALSE
  /\ other' = (FALSE)
  /\ UNCHANGED <<rows, badRedo, rebuilt>>

\* A pending local undo is rebuilt after a remote edit advanced the base.
\* The remote data update and the queued undo keep the same live key.
Rebuild ==
  /\ queued
  /\ \E d \in Data :
       /\ rows # d
       /\ \E k \in Keys : k = KeyOf(redo) /\ Present(rows, k) /\ Present(d, k)
       /\ Update(d, TRUE)

Redo ==
  /\ mode = "suppression" /\ UNCHANGED updateVars
  /\ Pending(redo)
  /\ hidden' = IF Owns(redo) THEN Put(hidden, redo) ELSE hidden
  /\ agent' = IF Owns(redo) THEN Lose(agent, redo) ELSE agent
  /\ other' = (other \/ (Owns(redo) /\ Pending(agent)))
  /\ redo' = 5 /\ queued' = FALSE
  /\ rebuilt' = FALSE
  /\ UNCHANGED <<rows, person, badUndo, badRedo>>

ChangeInputs ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ update = "none"
  /\ rows' = "ba" /\ update' = "written"
  /\ UNCHANGED <<hidden, raced, badUpdate, badRun>>

SuppressBar ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ update = "written"
  /\ \E k \in Keys :
       /\ Present(rows, k) /\ ~Member(hidden, k)
       /\ hidden' = Put(hidden, k)
  /\ UNCHANGED <<rows, update, raced, badUpdate, badRun>>

OverwriteInputs ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ update \in {"written", "pending"} /\ rows = "ba"
  /\ rows' = "a" /\ hidden' = hidden % 2
  /\ UNCHANGED <<update, raced, badUpdate, badRun>>

UndoUpdate ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ mode = "person" /\ update = "written"
  /\ rows' = IF rows = "ba" /\ ~(DropUpdateOnSuppression /\ hidden # 0) THEN "ab" ELSE rows
  /\ badUpdate' = (rows = "ba" /\ rows' # "ab")
  /\ update' = IF rows = "a" THEN "superseded" ELSE "done"
  /\ UNCHANGED <<hidden, raced, badRun>>

QueueUndoRun ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ mode = "run" /\ update = "written" /\ rows = "ba"
  /\ update' = "pending"
  /\ UNCHANGED <<rows, hidden, raced, badUpdate, badRun>>

RaceRun ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ mode = "run" /\ update = "pending" /\ ~raced
  /\ raced' = TRUE
  /\ UNCHANGED <<rows, hidden, update, badUpdate, badRun>>

UndoRun ==
  /\ mode # "suppression" /\ UNCHANGED <<mode, suppressionVars>>
  /\ mode = "run" /\ update = "pending"
  /\ LET written == ~(DropStaleRunUndo /\ raced) /\ ~(DropUpdateOnSuppression /\ hidden # 0)
     IN /\ rows' = IF written /\ (rows = "ba" \/ StaleRunRead) THEN "ab" ELSE rows
        /\ badUpdate' = (~raced /\ rows = "ba" /\ rows' # "ab")
        /\ badRun' = (raced /\ rows = "ba" /\ rows' # "ab")
  /\ update' = IF rows = "a" THEN "superseded" ELSE "done"
  /\ UNCHANGED <<hidden, raced>>

Next ==
  \/ DataUpdate \/ PersonDelete \/ AgentDelete \/ PersonUndo \/ AgentUndo \/ Rebuild \/ Redo
  \/ ChangeInputs \/ SuppressBar \/ OverwriteInputs \/ UndoUpdate \/ QueueUndoRun \/ RaceRun \/ UndoRun
Spec == Init /\ [][Next]_vars
NoExpiredSuppression == \A k \in Keys : Member(hidden, k) => Present(rows, k)
UndoRestoresOwnedKey == ~badUndo
RedoSurvivesRebuild == ~badRedo
UndoRestoresOwnedData == ~badUpdate
StaleRunUndoRebuilds == ~badRun
LaterDataWins == (update = "superseded") => rows = "a"
InstanceStaysUpdatable == Size(rows, hidden) <= 499
====
