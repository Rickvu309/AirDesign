---- MODULE LinkedRunOrder ----

CONSTANTS DropRedoFill, DropReturnedOverride, IgnoreOwnedRevs
VARIABLES scenario, phase, rows, fill, owner, parked
vars == <<scenario, phase, rows, fill, owner, parked>>

Init ==
  /\ scenario \in {"redo-fill", "row-return", "older-run"}
  /\ phase = "ready" /\ rows = "ab" /\ fill = "inherited"
  /\ owner = "initial" /\ parked = "none"

WriteRun ==
  /\ scenario \in {"redo-fill", "older-run"} /\ phase = "ready"
  /\ phase' = "written" /\ rows' = "ba" /\ owner' = "older"
  /\ fill' = IF scenario = "redo-fill" THEN "override" ELSE fill
  /\ UNCHANGED <<scenario, parked>>

WriteNewerRun ==
  /\ scenario = "older-run" /\ phase = "written"
  /\ phase' = "newer" /\ rows' = "a" /\ owner' = "newer" /\ fill' = "none"
  /\ UNCHANGED <<scenario, parked>>

UndoRun ==
  /\ ((scenario = "redo-fill" /\ phase = "written") \/
      (scenario = "older-run" /\ phase = "newer"))
  /\ phase' = "undone" /\ owner' = "undo"
  /\ rows' = IF scenario = "redo-fill" THEN "ab" ELSE "ba"
  /\ fill' = "inherited"
  /\ UNCHANGED <<scenario, parked>>

RedoRun ==
  /\ scenario = "redo-fill" /\ phase = "undone"
  /\ phase' = "done" /\ rows' = "ba" /\ owner' = "redo"
  /\ fill' = IF DropRedoFill THEN "inherited" ELSE "override"
  /\ UNCHANGED <<scenario, parked>>

UndoOlderRun ==
  /\ scenario = "older-run" /\ phase = "undone"
  /\ phase' = "done"
  /\ rows' = IF owner = "undo" /\ ~IgnoreOwnedRevs THEN "ab" ELSE rows
  /\ UNCHANGED <<scenario, owner, fill, parked>>

Recolour ==
  /\ scenario = "row-return" /\ phase = "ready"
  /\ phase' = "coloured" /\ fill' = "override"
  /\ UNCHANGED <<scenario, rows, owner, parked>>

RemoveRow ==
  /\ scenario = "row-return" /\ phase = "coloured"
  /\ phase' = "absent" /\ rows' = "a" /\ owner' = "remove"
  /\ parked' = fill /\ fill' = "none"
  /\ UNCHANGED scenario

UndoRemoveRow ==
  /\ scenario = "row-return" /\ phase = "absent"
  /\ phase' = "done" /\ rows' = "ab" /\ owner' = "undo"
  /\ fill' = IF DropReturnedOverride THEN "inherited" ELSE parked
  /\ parked' = "none"
  /\ UNCHANGED scenario

Next == WriteRun \/ WriteNewerRun \/ UndoRun \/ RedoRun \/ UndoOlderRun
        \/ Recolour \/ RemoveRow \/ UndoRemoveRow

Spec == Init /\ [][Next]_vars
RedoKeepsFill == (scenario = "redo-fill" /\ phase = "done") => fill = "override"
ReturnedRowKeepsFill == (scenario = "row-return" /\ phase = "done") => fill = "override"
RestoredInputCanBeUndone == (scenario = "older-run" /\ phase = "done") => rows = "ab"
====
