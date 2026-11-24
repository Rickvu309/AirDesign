---- MODULE UndoTurns ----
\* The turn an undo leaves on a card it does not put back into its old frame (`onStandingLayers` in
\* packages/doom/src/standing-layers.ts), for a person's Ctrl+Z and Ctrl+Y (`invert`) and Undo on an agent run
\* (`invertRun`), beside another tab's turns of the frames above the card, its deletes and an agent's move of the card.
\* The slide holds frame P, turned 2, with the card K in it, and frame Q, turned 1, which holds frame H. Turns count in
\* units of 15 degrees and wrap at 24. kp is K's frame (0 the slide, 1 P, 2 H), kr K's turn in that frame, hr and qr the
\* turns of H and Q. pg and qg name the edit that deleted P or Q, 0 while it stands. Edits are numbered from 1 in the
\* order they land. wkp, wkr, whr and wqr name the edit that wrote K's frame, K's turn, H's turn and Q's turn last, and
\* turned is the set of presses that landed, as bits.
\* First the person, or an agent run, moves K into H in one edit. It keeps K's turn on the slide, as a person's move and
\* a re-measuring agent do, turns K one unit more, as an agent's own `rotation` can, or keeps K's turn in its frame, as
\* the agent's `move` does. It may also turn H by one unit. After a person's move, an agent run may move K from H onto
\* the slide and keep its turn in its frame. Another tab may turn H or Q once and delete P or Q once.
\* A press undoes the top step of a stack, or Undo on a run undoes that run. It writes back each of K's frame, K's turn
\* and H's turn that the step or a landed press wrote last. K goes back into its old frame unless that frame is
\* deleted, or K shows and the frame is under a deleted one. Where K stays, and where the press writes K's turn but not
\* K's frame and K has left the frame the step left it in, K's turn on the slide becomes its turn now minus the step's
\* own change of it, measured on the slide as the step left K against before the step, with the frames as the press
\* leaves them. With nothing to write it takes the step off and answers nothing. A press that lands pushes on the other
\* stack a step that writes back what it replaced.
\* A slot holds a step: the edit, which of K's frame (1), K's turn (2) and H's turn (4) it wrote, K's frame, K's turn
\* and H's turn before it, the frame it left K in, its own change of K's turn on the slide, and K's turn as it left it.
\* Slot 1 is the move, 2 the agent's later move, 3 to 5 the steps the presses pushed. A stack is a number in base 8 whose
\* last digit is the top step's slot.
EXTENDS Integers

CONSTANT Rule

TurnP == 2
Presses == 2

VARIABLES kp, kr, hr, qr, pg, qg, wkp, wkr, whr, wqr, n, us, rs, s1, s2, s3, s4, s5, turned, made, runs, moved,
  acted, gone, presses, pressed, ownsK, inPlace, told

vars == <<kp, kr, hr, qr, pg, qg, wkp, wkr, whr, wqr, n, us, rs, s1, s2, s3, s4, s5, turned, made, runs, moved,
  acted, gone, presses, pressed, ownsK, inPlace, told>>

M(t) == ((t % 24) + 24) % 24
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Chain(p, h, q) == CASE p = 0 -> 0 [] p = 1 -> TurnP [] OTHER -> M(h + q)
Slide == M(kr + Chain(kp, hr, qr))

Pack(e, m, bp, br, bh, li, ow, lk) == e + 8 * (m + 8 * (bp + 3 * (li + 3 * (br + 24 * (bh + 24 * (ow + 24 * lk))))))
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == Slot(k) % 8
Wrote(k, bit) == (((Slot(k) \div 8) % 8) \div bit) % 2 = 1
OldFrame(k) == (Slot(k) \div 64) % 3
LeftIn(k) == (Slot(k) \div 192) % 3
OldTurn(k) == (Slot(k) \div 576) % 24
OldH(k) == (Slot(k) \div 13824) % 24
Own(k) == (Slot(k) \div 331776) % 24
LeftTurn(k) == (Slot(k) \div 7962624) % 24

Shows == CASE kp = 1 -> pg = 0 [] kp = 2 -> qg = 0 [] OTHER -> TRUE
LandsIn(f) == CASE f = 1 -> pg = 0 [] f = 2 -> qg = 0 \/ ~Shows [] OTHER -> TRUE

TypeOK ==
  /\ kp \in 0..2 /\ {kr, hr, qr} \subseteq 0..23 /\ {pg, qg, wkp, wkr, whr, wqr, n} \subseteq 0..7
  /\ us \in 0..511 /\ rs \in 0..511 /\ turned \in 0..255
  /\ made \in {"none", "person", "run"} /\ runs \in 0..3 /\ moved \in BOOLEAN /\ acted \in BOOLEAN
  /\ gone \in BOOLEAN /\ presses \in 0..3 /\ pressed \in 0..5 /\ ownsK \in BOOLEAN /\ inPlace \in BOOLEAN
  /\ told \in {"none", "undone", "nothing"}

Init ==
  /\ kp = 1 /\ kr = 0 /\ hr = 0 /\ qr = 1 /\ pg = 0 /\ qg = 0
  /\ wkp = 0 /\ wkr = 0 /\ whr = 0 /\ wqr = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0 /\ turned = 0
  /\ made = "none" /\ runs = 0 /\ moved = FALSE /\ acted = FALSE /\ gone = FALSE
  /\ presses = 0 /\ pressed = 0 /\ ownsK = FALSE /\ inPlace = FALSE /\ told = "none"

Quiet == pressed' = 0 /\ ownsK' = FALSE /\ inPlace' = FALSE /\ told' = "none"

Step ==
  \E by \in {"person", "run"}, how \in {"measured", "turned", "kept"}, h \in 0..1 :
    /\ made = "none" /\ (by = "person") = (how # "kept") /\ (h = 1) = (how = "measured")
    /\ LET nh == M(hr + h)
           nr == CASE how = "measured" -> M(Slide - Chain(2, nh, qr))
                   [] how = "turned" -> M(Slide + 1 - Chain(2, nh, qr))
                   [] OTHER -> kr IN
       /\ kp' = 2 /\ kr' = nr /\ hr' = nh
       /\ s1' = Pack(n + 1, 3 + 4 * h, kp, kr, hr, 2, M(nr + Chain(2, nh, qr) - Slide), nr)
    /\ wkp' = n + 1 /\ wkr' = n + 1
    /\ whr' = IF h = 1 THEN n + 1 ELSE whr
    /\ n' = n + 1 /\ made' = by
    /\ us' = IF by = "person" THEN 1 ELSE 0
    /\ runs' = IF by = "run" THEN 1 ELSE 0
    /\ Quiet
    /\ UNCHANGED <<qr, pg, qg, wqr, rs, s2, s3, s4, s5, turned, moved, acted, gone, presses>>

AgentMove ==
  /\ made = "person" /\ ~moved /\ presses = 0 /\ kp = 2 /\ Shows
  /\ kp' = 0 /\ wkp' = n + 1 /\ wkr' = n + 1
  /\ s2' = Pack(n + 1, 3, kp, kr, hr, 0, M(kr - Slide), kr)
  /\ n' = n + 1 /\ moved' = TRUE /\ runs' = runs + 2
  /\ Quiet
  /\ UNCHANGED <<kr, hr, qr, pg, qg, whr, wqr, us, rs, s1, s3, s4, s5, turned, made, acted, gone, presses>>

OtherTurn ==
  \E f \in {"H", "Q"} :
    /\ made # "none" /\ ~acted /\ qg = 0 /\ presses < Presses
    /\ hr' = IF f = "H" THEN M(hr + 1) ELSE hr
    /\ whr' = IF f = "H" THEN n + 1 ELSE whr
    /\ qr' = IF f = "Q" THEN M(qr + 1) ELSE qr
    /\ wqr' = IF f = "Q" THEN n + 1 ELSE wqr
    /\ n' = n + 1 /\ acted' = TRUE
    /\ Quiet
    /\ UNCHANGED <<kp, kr, pg, qg, wkp, wkr, us, rs, s1, s2, s3, s4, s5, turned, made, runs, moved, gone, presses>>

OtherDelete ==
  \E f \in {"P", "Q"} :
    /\ made # "none" /\ ~gone /\ presses = 0
    /\ pg' = IF f = "P" THEN n + 1 ELSE pg
    /\ qg' = IF f = "Q" THEN n + 1 ELSE qg
    /\ n' = n + 1 /\ gone' = TRUE
    /\ Quiet
    /\ UNCHANGED <<kp, kr, hr, qr, wkp, wkr, whr, wqr, us, rs, s1, s2, s3, s4, s5, turned, made, runs, moved, acted,
                   presses>>

IsRun(k) == k = 2 \/ (k = 1 /\ made = "run")
TurnedSince(k) == CASE kp = 2 -> whr > Edit(k) \/ wqr > Edit(k) \/ qg > Edit(k) [] kp = 1 -> pg > Edit(k) [] OTHER -> FALSE

\* The turn the press writes for a K it leaves where it sits, with H's turn nh and K's frame's turn chain as the press
\* leaves them. "delta" is the code. The others are planted: "keep" is main, "rebuildAtUndo" verdict 1532-759e007 and
\* "rebuildFromLeft" verdict 1532-cfcc610.
Placed(k, nh, chain) ==
  CASE Rule = "delta" -> M(Slide - Own(k) - chain)
    [] Rule = "keep" -> kr
    [] Rule = "rebuildAtUndo" /\ IsRun(k) -> M(OldTurn(k) + Chain(OldFrame(k), hr, qr) - chain)
    [] Rule = "rebuildAtUndo" -> M(OldTurn(k) + Chain(OldFrame(k), OldH(k), qr) - chain)
    [] Rule = "rebuildFromLeft" /\ IsRun(k) ->
         IF TurnedSince(k) THEN kr ELSE M(OldTurn(k) + Chain(OldFrame(k), nh, qr) - chain)
    [] Rule = "rebuildFromLeft" -> M(LeftTurn(k) - Own(k) + Chain(kp, hr, qr) - chain)

\* Press on the step in slot k. It owns what the step or a landed press wrote last, and fills slot `into` with the step
\* that writes back what it replaced.
Turns(k, into) ==
  LET owns(w) == w = Edit(k) \/ In(turned, w)
      wp == Wrote(k, 1) /\ owns(wkp)
      wr == Wrote(k, 2) /\ owns(wkr)
      wh == Wrote(k, 4) /\ owns(whr)
      lands == wp /\ LandsIn(OldFrame(k))
      placed == (wp /\ ~lands) \/ (~wp /\ kp # LeftIn(k))
      np == IF lands THEN OldFrame(k) ELSE kp
      nh == IF wh THEN OldH(k) ELSE hr
      nr == IF ~wr THEN kr ELSE IF placed THEN Placed(k, nh, Chain(np, nh, qr)) ELSE OldTurn(k)
      writesR == wr /\ (~placed \/ nr # kr)
      landed == lands \/ writesR \/ wh
      slot == Pack(n + 1, (IF lands THEN 1 ELSE 0) + (IF writesR THEN 2 ELSE 0) + (IF wh THEN 4 ELSE 0),
                   kp, kr, hr, np, M(nr + Chain(np, nh, qr) - Slide), nr) IN
  /\ ownsK' = wr /\ inPlace' = placed
  /\ IF landed
     THEN /\ kp' = np /\ kr' = nr /\ hr' = nh
          /\ wkp' = IF lands THEN n + 1 ELSE wkp
          /\ wkr' = IF writesR THEN n + 1 ELSE wkr
          /\ whr' = IF wh THEN n + 1 ELSE whr
          /\ s3' = IF into = 3 THEN slot ELSE s3
          /\ s4' = IF into = 4 THEN slot ELSE s4
          /\ s5' = IF into = 5 THEN slot ELSE s5
          /\ turned' = turned + 2 ^ (n + 1) /\ n' = n + 1 /\ told' = "undone"
     ELSE /\ told' = "nothing"
          /\ UNCHANGED <<kp, kr, hr, wkp, wkr, whr, s3, s4, s5, turned, n>>

Undo ==
  /\ presses < Presses /\ us > 0
  /\ LET k == us % 8 IN
       /\ Turns(k, 3 + presses)
       /\ us' = us \div 8 /\ pressed' = k
       /\ rs' = IF told' = "undone" THEN rs * 8 + 3 + presses ELSE rs
  /\ presses' = presses + 1
  /\ UNCHANGED <<qr, pg, qg, wqr, s1, s2, made, runs, moved, acted, gone>>

Redo ==
  /\ presses < Presses /\ rs > 0
  /\ LET k == rs % 8 IN
       /\ Turns(k, 3 + presses)
       /\ rs' = rs \div 8 /\ pressed' = k
       /\ us' = IF told' = "undone" THEN us * 8 + 3 + presses ELSE us
  /\ presses' = presses + 1
  /\ UNCHANGED <<qr, pg, qg, wqr, s1, s2, made, runs, moved, acted, gone>>

UndoRun ==
  \E k \in {1, 2} :
    /\ presses < Presses /\ In(runs, k - 1)
    /\ Turns(k, 3 + presses)
    /\ pressed' = k
    /\ runs' = IF told' = "undone" THEN runs - 2 ^ (k - 1) ELSE runs
    /\ rs' = IF told' = "undone" THEN rs * 8 + 3 + presses ELSE rs
    /\ presses' = presses + 1
    /\ UNCHANGED <<qr, pg, qg, wqr, us, s1, s2, made, moved, acted, gone>>

Next == Step \/ AgentMove \/ OtherTurn \/ OtherDelete \/ Undo \/ Redo \/ UndoRun

Spec == Init /\ [][Next]_vars

Pressed == presses' > presses

\* A press that writes the turn of a K it leaves where it sits takes off only the step's own change of K's turn on the
\* slide: K ends at the turn the person saw before the step, plus every turn others gave it since.
PutsBackWhereSeen == [][Pressed /\ ownsK' /\ inPlace' => Slide' = M(Slide - Own(pressed'))]_vars

\* A press never takes another writer's turn off a K it leaves where it sits: K ends at the turn the person saw plus
\* theirs, or keeps its turn in its frame. It never writes H's turn when another writer wrote it last.
NeverCoversTheirs ==
  [][Pressed =>
       /\ inPlace' => Slide' \in {M(Slide - Own(pressed')), M(kr + Chain(kp, hr', qr))}
       /\ hr' # hr => whr = Edit(pressed') \/ In(turned, whr)]_vars

\* Every press takes its step off, so the next press reaches the step below it.
NeverStuck == [][Pressed => (<<us', rs'>> # <<us, rs>> \/ runs' # runs \/ told' = "nothing")]_vars

====
