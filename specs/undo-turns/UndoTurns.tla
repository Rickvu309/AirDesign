---- MODULE UndoTurns ----
\* The turn an undo leaves on a layer whose move it leaves in place (`boxLeftInPlace` in
\* packages/doom/src/standing-layers.ts), for a person's step (`invert`) and an agent run (`invertRun`).
\* Layers are numbered: 0 the slide, 1 frame P on the slide, turned 2, 4 frame H on the slide, and the card K in P.
\* Turns count in units of 15 degrees. pK is K's frame, rK its turn in that frame, tH the turn of H, and wH who wrote
\* tH last: 0 the file, 1 the step, 2 the other tab, 3 the undo. gone is TRUE once another tab deleted P.
\* The step moves K into H and keeps its turn on the slide, plus look more units, as an agent's own rotation can,
\* and may turn H by one unit in the same edit (byH). A person makes it, or an agent run (run).
\* Another tab may turn H by one unit once, before or after the step (dH is 1 when it did so after the step), and
\* may delete P once the step landed. Then the person presses Ctrl+Z, or Undo on the run, once.
\* The undo puts K back into P while P stands. Otherwise it leaves K in H at the turn K has there. It writes H's turn
\* back only while the step wrote it last.
EXTENDS Integers

TurnP == 2

VARIABLES made, run, look, byH, pK, rK, tH, wH, hBefore, gone, turnedH, dH, pressed, told

vars == <<made, run, look, byH, pK, rK, tH, wH, hBefore, gone, turnedH, dH, pressed, told>>

TypeOK ==
  /\ made \in BOOLEAN /\ run \in BOOLEAN /\ look \in 0..1 /\ byH \in 0..1 /\ pK \in {1, 4}
  /\ rK \in -4..4 /\ tH \in 0..3 /\ wH \in 0..3 /\ hBefore \in 0..3
  /\ gone \in BOOLEAN /\ turnedH \in BOOLEAN /\ dH \in 0..1 /\ pressed \in BOOLEAN
  /\ told \in {"none", "undone", "nothing to undo"}

Init ==
  /\ made = FALSE /\ run = FALSE /\ look = 0 /\ byH = 0 /\ pK = 1 /\ rK = 0 /\ tH = 0 /\ wH = 0
  /\ hBefore = 0 /\ gone = FALSE /\ turnedH = FALSE /\ dH = 0 /\ pressed = FALSE /\ told = "none"

Step ==
  \E byRun \in BOOLEAN, l \in 0..1, h \in 0..1 :
    /\ ~made
    /\ made' = TRUE /\ run' = byRun /\ look' = l /\ byH' = h
    /\ pK' = 4 /\ rK' = rK + TurnP - (tH + h) + l
    /\ tH' = tH + h /\ wH' = IF h = 1 THEN 1 ELSE wH
    /\ hBefore' = tH
    /\ UNCHANGED <<gone, turnedH, dH, pressed, told>>

OtherTurn ==
  /\ ~turnedH /\ ~pressed
  /\ turnedH' = TRUE /\ tH' = tH + 1 /\ wH' = 2 /\ dH' = IF made THEN 1 ELSE 0
  /\ UNCHANGED <<made, run, look, byH, pK, rK, hBefore, gone, pressed, told>>

OtherDelete ==
  /\ made /\ ~gone /\ ~pressed
  /\ gone' = TRUE
  /\ UNCHANGED <<made, run, look, byH, pK, rK, tH, wH, hBefore, turnedH, dH, pressed, told>>

BackH == byH = 1 /\ wH = 1

Undo ==
  /\ made /\ ~pressed
  /\ pressed' = TRUE
  /\ pK' = IF gone THEN 4 ELSE 1
  /\ rK' = IF gone THEN rK ELSE 0
  /\ tH' = IF BackH THEN hBefore ELSE tH
  /\ wH' = IF BackH THEN 3 ELSE wH
  /\ told' = IF ~gone \/ BackH THEN "undone" ELSE "nothing to undo"
  /\ UNCHANGED <<made, run, look, byH, hBefore, gone, turnedH, dH>>

Next == Step \/ OtherTurn \/ OtherDelete \/ Undo

Spec == Init /\ [][Next]_vars

SlideTurn == rK + (IF pK = 1 THEN TurnP ELSE tH)
Pressed == pressed' /\ ~pressed

\* A press never cancels another tab's turn of K's new frame, on K or on the frame. Once they turned H after the step,
\* a K left in H ends at the turn the person saw plus theirs, or stays as it is, which carries theirs. It never gets
\* a counter-turn that takes their turn off K, and the undo never writes H's turn when they wrote it last.
NeverCoversTheirs ==
  [][Pressed =>
     /\ (pK' = 4 /\ dH = 1) => SlideTurn' \in {TurnP + 1, SlideTurn}
     /\ tH' # tH => wH # 2]_vars

====
