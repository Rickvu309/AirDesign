---- MODULE DoomRuns ----
\* Two agent runs, a and b, and a person write two properties of the doom: the text of a shape (T) and the
\* notes of a slide (N), each on its own node. A value is the number of the edit that first wrote it (0 is the
\* file's own) and a rev is the number of the edit that wrote last: the person's write is 1, run a's write 2,
\* its undo 3 and run b's write 5.
\* Runs a and b belong to two agents, so neither start stops the other run: a start stops only its own
\* agent's running run, which specs/agents models.
\* A run starts with an id no run used before (applyEdit refuses a start that names a known run), writes one
\* property once with the property's rev as its base, and stops. Run b starts once run a has started, so the
\* two may run at once, and writes the text. A person's edit protects the nodes it wrote from each run that is
\* running when it lands, and from no run that starts later (protect in packages/doom/src/apply-edit.ts). A
\* write by a run that is not running is fenced. The person writes the text once, and no run holds it back.
\* Once run a has stopped the person may undo it, once, the way undoRun in packages/live/src/doom-deck.ts
\* does: a person's edit that puts back, on each property the run wrote whose rev is still the run's, the
\* value it showed when the run started (invert in packages/doom/src/invert.ts). As a person's edit it
\* protects what it writes from a run that is running.
EXTENDS Integers

VARIABLES vT, tT, vN, tN, p, ra, rb, gaT, gaN, gbT, wa, wb, ka, saT, saN, ua

vars == <<vT, tT, vN, tN, p, ra, rb, gaT, gaN, gbT, wa, wb, ka, saT, saN, ua>>

Values == {0, 1, 2, 5}
Phases == {"idle", "running", "stopped"}
Writes == {"none", "landed", "fenced", "person"}

TypeOK ==
  /\ vT \in Values /\ vN \in Values /\ tT \in {0, 1, 2, 3, 5} /\ tN \in {0, 1, 2, 3, 5}
  /\ p \in BOOLEAN
  /\ ra \in Phases /\ rb \in Phases
  /\ gaT \in BOOLEAN /\ gaN \in BOOLEAN /\ gbT \in BOOLEAN
  /\ wa \in Writes /\ wb \in Writes
  /\ ka \in {"none", "T", "N"}
  /\ saT \in Values /\ saN \in Values
  /\ ua \in {"none", "landed", "empty"}

Init ==
  /\ vT = 0 /\ tT = 0 /\ vN = 0 /\ tN = 0
  /\ p = FALSE
  /\ ra = "idle" /\ rb = "idle"
  /\ gaT = FALSE /\ gaN = FALSE /\ gbT = FALSE
  /\ wa = "none" /\ wb = "none" /\ ka = "none"
  /\ saT = 0 /\ saN = 0
  /\ ua = "none"

Tag(k) == IF k = "T" THEN tT ELSE tN

\* A person's edit on T, N or both protects those nodes from each run that is running.
Protect(onT, onN) ==
  /\ gaT' = (gaT \/ (ra = "running" /\ onT))
  /\ gaN' = (gaN \/ (ra = "running" /\ onN))
  /\ gbT' = (gbT \/ (rb = "running" /\ onT))

PersonWrites ==
  /\ ~p
  /\ p' = TRUE
  /\ vT' = 1 /\ tT' = 1
  /\ Protect(TRUE, FALSE)
  /\ UNCHANGED <<vN, tN, ra, rb, wa, wb, ka, saT, saN, ua>>

\* A run starts with no protection of its own, whatever a person wrote during another run.
StartA ==
  /\ ra = "idle"
  /\ ra' = "running"
  /\ saT' = vT /\ saN' = vN
  /\ UNCHANGED <<vT, tT, vN, tN, p, rb, gaT, gaN, gbT, wa, wb, ka, ua>>

StartB ==
  /\ ra # "idle"
  /\ rb = "idle"
  /\ rb' = "running"
  /\ UNCHANGED <<vT, tT, vN, tN, p, ra, gaT, gaN, gbT, wa, wb, ka, saT, saN, ua>>

StopA ==
  /\ ra = "running"
  /\ ra' = "stopped"
  /\ UNCHANGED <<vT, tT, vN, tN, p, rb, gaT, gaN, gbT, wa, wb, ka, saT, saN, ua>>

StopB ==
  /\ rb = "running"
  /\ rb' = "stopped"
  /\ UNCHANGED <<vT, tT, vN, tN, p, ra, gaT, gaN, gbT, wa, wb, ka, saT, saN, ua>>

\* A run's one write, once the run has started, lands only while the run is running and on a node no person
\* wrote during the run. Otherwise it is refused and nothing changes. A write before the run starts is fenced
\* the same way; the doom model holds that one.
WriteA(k) ==
  /\ ra # "idle"
  /\ wa = "none"
  /\ ka' = k
  /\ IF ra # "running" THEN wa' = "fenced" /\ UNCHANGED <<vT, tT, vN, tN>>
     ELSE IF (IF k = "T" THEN gaT ELSE gaN) THEN wa' = "person" /\ UNCHANGED <<vT, tT, vN, tN>>
     ELSE /\ wa' = "landed"
          /\ vT' = IF k = "T" THEN 2 ELSE vT
          /\ tT' = IF k = "T" THEN 2 ELSE tT
          /\ vN' = IF k = "N" THEN 2 ELSE vN
          /\ tN' = IF k = "N" THEN 2 ELSE tN
  /\ UNCHANGED <<p, ra, rb, gaT, gaN, gbT, wb, saT, saN, ua>>

\* Run b writes the text, the property the person writes, while it runs. Run a holds the fence for both.
WriteB ==
  /\ rb = "running"
  /\ wb = "none"
  /\ IF gbT THEN wb' = "person" /\ UNCHANGED <<vT, tT>>
     ELSE wb' = "landed" /\ vT' = 5 /\ tT' = 5
  /\ UNCHANGED <<vN, tN, p, ra, rb, gaT, gaN, gbT, wa, ka, saT, saN, ua>>

\* The undo of a stopped run puts back the value its property showed when the run started, while the
\* property's rev is still the run's write. Otherwise it finds nothing to put back and the person is told.
UndoA ==
  /\ ra = "stopped" /\ ua = "none"
  /\ IF wa = "landed" /\ Tag(ka) = 2
       THEN /\ ua' = "landed"
            /\ vT' = IF ka = "T" THEN saT ELSE vT
            /\ tT' = IF ka = "T" THEN 3 ELSE tT
            /\ vN' = IF ka = "N" THEN saN ELSE vN
            /\ tN' = IF ka = "N" THEN 3 ELSE tN
            /\ Protect(ka = "T", ka = "N")
       ELSE /\ ua' = "empty"
            /\ UNCHANGED <<vT, tT, vN, tN, gaT, gaN, gbT>>
  /\ UNCHANGED <<p, ra, rb, wa, wb, ka, saT, saN>>

Next ==
  \/ PersonWrites
  \/ StartA \/ StartB \/ StopA \/ StopB
  \/ WriteA("T") \/ WriteA("N") \/ WriteB
  \/ UndoA

Spec == Init /\ [][Next]_vars

\* A run's write lands only on a node no person wrote while that run was running.
RunRespectsPerson ==
  [][/\ (wa = "none" /\ wa' = "landed") => ~(IF ka' = "T" THEN gaT ELSE gaN)
     /\ (wb = "none" /\ wb' = "landed") => ~gbT]_vars

\* A run's write lands only while the run is running.
FenceHolds ==
  [][/\ (wa = "none" /\ wa' = "landed") => ra = "running"
     /\ (wb = "none" /\ wb' = "landed") => rb = "running"]_vars

\* A protection belongs to the run that was running when the person wrote: a run starts with none.
ProtectionStaysWithItsRun ==
  [][/\ (ra = "idle" /\ ra' = "running") => ~(gaT' \/ gaN')
     /\ (rb = "idle" /\ rb' = "running") => ~gbT']_vars

\* Only a person's edit protects a node, and only the node it wrote: the person wrote the text, and an undo
\* wrote the property of the run it undid.
ProtectedOnlyByThePerson ==
  /\ (gaT \/ gbT) => (p \/ (ua = "landed" /\ ka = "T"))
  /\ gaN => (ua = "landed" /\ ka = "N")

\* The undo of run a changes only the property that run wrote, and only while its rev is still the run's:
\* the person's write and run b's write that came after it stay.
UndoTakesBackOnlyItsRun ==
  [][(ua = "none" /\ ua' # "none") =>
       /\ (tT' # tT \/ vT' # vT) => (ka = "T" /\ tT = 2 /\ vT' = saT)
       /\ (tN' # tN \/ vN' # vN) => (ka = "N" /\ tN = 2 /\ vN' = saN)]_vars

\* The undo puts the run's write back whenever its rev still shows it.
UndoPutsBack == [][(ua = "none" /\ ua' # "none" /\ wa = "landed" /\ Tag(ka) = 2) => ua' = "landed"]_vars

====
