---- MODULE Doom ----
\* One person and one agent run write two properties of the doom: the text of a shape (T) and the notes of
\* a slide (N), each on its own node. Every property has a value and a rev: here a value is the number of
\* the edit that first wrote it (0 is the file's own), and a rev is the number of the edit that wrote last.
\* The person makes one step that names both properties (edit 1, a person's edit on two nodes), then asks for
\* an undo and a redo. Each turn is an edit that puts back, for each property the step wrote, the value it
\* replaced, but only where the person's view still shows the edit's own rev (invert in
\* packages/document/src/doom/invert.ts). Its writes carry the rev they undo as `base`, and the server lands
\* an edit whole or not at all (applyEdit): a write whose base is not the property's rev refuses the edit.
\* The step and each turn go to the device's queue and reach the server in order, one at a time (Sync). The
\* person's view is the server's fold with the queued edits on top (viewOf), so a turn is asked of the view
\* and may be asked while the step is still on its way.
\* An agent run starts, reads one property's rev, writes it once with that base, and stops. A person's edit that
\* lands while the run is running protects its nodes from the run; a write by a run that is not running is
\* fenced. The agent's value is 2 and its edit is 2; the person's step is 1, the first turn 3 and the second 4.
\* An edit is named by its number, and a set of properties by 1 for T, 2 for N and 3 for both.
EXTENDS Integers

VARIABLES vT, tT, vN, tN, s, u, r, sbT, sbN, bT, bN, uK, rK, run, gT, gN, g, told, turns, wrote, covered

vars == <<vT, tT, vN, tN, s, u, r, sbT, sbN, bT, bN, uK, rK, run, gT, gN, g, told, turns, wrote, covered>>

Has(mask, bit) == (mask \div bit) % 2 = 1
Bit(k) == IF k = "T" THEN 1 ELSE 2
Tag(k) == IF k = "T" THEN tT ELSE tN
Val(k) == IF k = "T" THEN vT ELSE vN
Guarded(k) == IF k = "T" THEN gT ELSE gN

\* The person's view: the server's rev and value of a property, then each queued edit in order on top.
ViewTag(k) ==
  IF r = "pending" /\ Has(rK, Bit(k)) THEN 4
  ELSE IF u = "pending" /\ Has(uK, Bit(k)) THEN 3
  ELSE IF s = "pending" THEN 1
  ELSE Tag(k)
ViewVal(k) ==
  IF r = "pending" /\ Has(rK, Bit(k)) THEN 1
  ELSE IF u = "pending" /\ Has(uK, Bit(k)) THEN (IF k = "T" THEN bT ELSE bN)
  ELSE IF s = "pending" THEN 1
  ELSE Val(k)

TypeOK ==
  /\ vT \in 0..4 /\ tT \in 0..4 /\ vN \in 0..4 /\ tN \in 0..4
  /\ s \in {"none", "pending", "landed", "refused"}
  /\ u \in {"none", "pending", "landed", "refused", "dropped"}
  /\ r \in {"none", "pending", "landed", "refused", "dropped"}
  /\ sbT \in 0..4 /\ sbN \in 0..4 /\ bT \in 0..4 /\ bN \in 0..4
  /\ uK \in 0..3 /\ rK \in 0..3
  /\ run \in {"idle", "running", "stopped"}
  /\ gT \in BOOLEAN /\ gN \in BOOLEAN
  /\ g \in {"none", "landed", "fenced", "person"}
  /\ told \in {"none", "empty", "stale"}
  /\ turns \in 0..2
  /\ wrote \in 0..3
  /\ covered \in BOOLEAN

Init ==
  /\ vT = 0 /\ tT = 0 /\ vN = 0 /\ tN = 0
  /\ s = "none" /\ u = "none" /\ r = "none"
  /\ sbT = 0 /\ sbN = 0 /\ bT = 0 /\ bN = 0 /\ uK = 0 /\ rK = 0
  /\ run = "idle" /\ gT = FALSE /\ gN = FALSE
  /\ g = "none"
  /\ told = "none" /\ turns = 0 /\ wrote = 0 /\ covered = FALSE

\* The person's step names both properties, on the view the person sees.
PersonStep ==
  /\ s = "none"
  /\ s' = "pending"
  /\ sbT' = ViewTag("T") /\ sbN' = ViewTag("N")
  /\ bT' = ViewVal("T") /\ bN' = ViewVal("N")
  /\ UNCHANGED <<vT, tT, vN, tN, u, r, uK, rK, run, gT, gN, g, told, turns, wrote, covered>>

\* An undo names each property where the view still shows the step's rev. With none, nothing is sent and the
\* person is told.
UndoMask == (IF ViewTag("T") = 1 THEN 1 ELSE 0) + (IF ViewTag("N") = 1 THEN 2 ELSE 0)

PersonUndo ==
  /\ s \in {"pending", "landed", "refused"}
  /\ u = "none"
  /\ turns = 0
  /\ turns' = 1
  /\ IF UndoMask = 0
       THEN /\ u' = "dropped"
            /\ told' = "empty"
            /\ UNCHANGED uK
       ELSE /\ u' = "pending"
            /\ uK' = UndoMask
            /\ UNCHANGED told
  /\ UNCHANGED <<vT, tT, vN, tN, s, r, sbT, sbN, bT, bN, rK, run, gT, gN, g, wrote, covered>>

RedoMask == (IF Has(uK, 1) /\ ViewTag("T") = 3 THEN 1 ELSE 0) + (IF Has(uK, 2) /\ ViewTag("N") = 3 THEN 2 ELSE 0)

PersonRedo ==
  /\ u \in {"pending", "landed", "refused"}
  /\ r = "none"
  /\ turns = 1
  /\ turns' = 2
  /\ IF RedoMask = 0
       THEN /\ r' = "dropped"
            /\ told' = "empty"
            /\ UNCHANGED rK
       ELSE /\ r' = "pending"
            /\ rK' = RedoMask
            /\ UNCHANGED told
  /\ UNCHANGED <<vT, tT, vN, tN, s, u, sbT, sbN, bT, bN, uK, run, gT, gN, g, wrote, covered>>

\* A person's edit that lands while the run is running protects the nodes it wrote.
Protect(mask) ==
  /\ gT' = (gT \/ (run = "running" /\ Has(mask, 1)))
  /\ gN' = (gN \/ (run = "running" /\ Has(mask, 2)))

\* The step reaches the server first. It lands whole if both properties' revs are what the person's view held.
SyncStep ==
  /\ s = "pending"
  /\ IF sbT = tT /\ sbN = tN
       THEN /\ vT' = 1 /\ tT' = 1 /\ vN' = 1 /\ tN' = 1
            /\ s' = "landed"
            /\ wrote' = 3
            /\ Protect(3)
            /\ covered' = (covered \/ (tT = 2 /\ sbT # 2) \/ (tN = 2 /\ sbN # 2))
            /\ UNCHANGED told
       ELSE /\ s' = "refused"
            /\ told' = "stale"
            /\ wrote' = 0
            /\ UNCHANGED <<vT, tT, vN, tN, gT, gN, covered>>
  /\ UNCHANGED <<u, r, sbT, sbN, bT, bN, uK, rK, run, g, turns>>

\* The undo lands after the step has left the queue. Its base is the step's rev on each property it names.
SyncUndo ==
  /\ u = "pending"
  /\ s # "pending"
  /\ IF (~Has(uK, 1) \/ tT = 1) /\ (~Has(uK, 2) \/ tN = 1)
       THEN /\ vT' = IF Has(uK, 1) THEN bT ELSE vT
            /\ tT' = IF Has(uK, 1) THEN 3 ELSE tT
            /\ vN' = IF Has(uK, 2) THEN bN ELSE vN
            /\ tN' = IF Has(uK, 2) THEN 3 ELSE tN
            /\ u' = "landed"
            /\ wrote' = uK
            /\ Protect(uK)
            /\ covered' = (covered \/ (Has(uK, 1) /\ tT = 2) \/ (Has(uK, 2) /\ tN = 2))
            /\ UNCHANGED told
       ELSE /\ u' = "refused"
            /\ told' = "stale"
            /\ wrote' = 0
            /\ UNCHANGED <<vT, tT, vN, tN, gT, gN, covered>>
  /\ UNCHANGED <<s, r, sbT, sbN, bT, bN, uK, rK, run, g, turns>>

SyncRedo ==
  /\ r = "pending"
  /\ u # "pending"
  /\ IF (~Has(rK, 1) \/ tT = 3) /\ (~Has(rK, 2) \/ tN = 3)
       THEN /\ vT' = IF Has(rK, 1) THEN 1 ELSE vT
            /\ tT' = IF Has(rK, 1) THEN 4 ELSE tT
            /\ vN' = IF Has(rK, 2) THEN 1 ELSE vN
            /\ tN' = IF Has(rK, 2) THEN 4 ELSE tN
            /\ r' = "landed"
            /\ wrote' = rK
            /\ Protect(rK)
            /\ covered' = (covered \/ (Has(rK, 1) /\ tT = 2) \/ (Has(rK, 2) /\ tN = 2))
            /\ UNCHANGED told
       ELSE /\ r' = "refused"
            /\ told' = "stale"
            /\ wrote' = 0
            /\ UNCHANGED <<vT, tT, vN, tN, gT, gN, covered>>
  /\ UNCHANGED <<s, u, sbT, sbN, bT, bN, uK, rK, run, g, turns>>

AgentStart ==
  /\ run = "idle"
  /\ run' = "running"
  /\ UNCHANGED <<vT, tT, vN, tN, s, u, r, sbT, sbN, bT, bN, uK, rK, gT, gN, g, told, turns, wrote, covered>>

AgentStop ==
  /\ run = "running"
  /\ run' = "stopped"
  /\ UNCHANGED <<vT, tT, vN, tN, s, u, r, sbT, sbN, bT, bN, uK, rK, gT, gN, g, told, turns, wrote, covered>>

\* The agent writes one property, once. It lands only while the run is running and on a node no person wrote
\* during the run. Otherwise it is refused and nothing changes. Its base is the rev on the deck it was compiled on,
\* and a person's landed edit on that node would have protected it first, so the rev check never decides here.
AgentWrite(k) ==
  /\ g = "none"
  /\ IF run # "running" THEN g' = "fenced" /\ UNCHANGED <<vT, tT, vN, tN, wrote>>
     ELSE IF Guarded(k) THEN g' = "person" /\ UNCHANGED <<vT, tT, vN, tN, wrote>>
     ELSE /\ g' = "landed"
          /\ vT' = IF k = "T" THEN 2 ELSE vT
          /\ tT' = IF k = "T" THEN 2 ELSE tT
          /\ vN' = IF k = "N" THEN 2 ELSE vN
          /\ tN' = IF k = "N" THEN 2 ELSE tN
          /\ wrote' = Bit(k)
  /\ UNCHANGED <<s, u, r, sbT, sbN, bT, bN, uK, rK, run, gT, gN, told, turns, covered>>

Next ==
  \/ PersonStep \/ PersonUndo \/ PersonRedo
  \/ SyncStep \/ SyncUndo \/ SyncRedo
  \/ AgentStart \/ AgentStop \/ AgentWrite("T") \/ AgentWrite("N")

Spec == Init /\ [][Next]_vars

\* A landed edit changes the value and the rev of the properties it names and of no other.
FoldsApart ==
  [][/\ (vT' # vT \/ tT' # tT) => Has(wrote', 1)
     /\ (vN' # vN \/ tN' # tN) => Has(wrote', 2)]_vars

\* No edit of the person lands over an agent's write the person's view did not hold: a step lands only on the revs
\* its view held, and an undo or redo only where the property still holds the rev it undoes.
NeverCoversAgent == ~covered

\* An undo names exactly the properties whose rev in the person's view is still the step's, and a redo those still
\* at the undo's. A property someone wrote since is left alone.
UndoNamesWhatRemains ==
  [][(u = "none" /\ u' = "pending") =>
       /\ Has(uK', 1) <=> ViewTag("T") = 1
       /\ Has(uK', 2) <=> ViewTag("N") = 1]_vars
RedoNamesWhatRemains ==
  [][(r = "none" /\ r' = "pending") =>
       /\ Has(rK', 1) <=> (Has(uK, 1) /\ ViewTag("T") = 3)
       /\ Has(rK', 2) <=> (Has(uK, 2) /\ ViewTag("N") = 3)]_vars

\* An undo that lands puts back, on every property it names, the value the step replaced, and a redo puts back
\* the step's own value. Each lands on all the properties it names or on none.
UndoPutsBack ==
  [][(u = "pending" /\ u' = "landed") =>
       /\ Has(uK, 1) => (vT' = bT /\ tT' = 3)
       /\ Has(uK, 2) => (vN' = bN /\ tN' = 3)]_vars
RedoPutsBack ==
  [][(r = "pending" /\ r' = "landed") =>
       /\ Has(rK, 1) => (vT' = 1 /\ tT' = 4)
       /\ Has(rK, 2) => (vN' = 1 /\ tN' = 4)]_vars
TurnLandsWhole ==
  [][((u = "pending" /\ u' = "refused") \/ (r = "pending" /\ r' = "refused") \/ (s = "pending" /\ s' = "refused"))
       => (vT' = vT /\ tT' = tT /\ vN' = vN /\ tN' = tN)]_vars

\* Nothing is refused, dropped or told unless the agent wrote a property the person's edit names.
ToldOnlyOverAgent == told # "none" => g = "landed"

\* An undo that changed nothing is told.
DroppedIsTold == (u = "dropped" \/ u = "refused" \/ r = "dropped" \/ r = "refused" \/ s = "refused") => told # "none"

\* The agent's write lands only on a node no person wrote during the run.
AgentRespectsPerson ==
  [][(g = "none" /\ g' = "landed") => ((wrote' = 1 => ~gT) /\ (wrote' = 2 => ~gN))]_vars

\* The agent's write lands only while its run is running.
FenceHolds == [][(g = "none" /\ g' = "landed") => run = "running"]_vars

====
