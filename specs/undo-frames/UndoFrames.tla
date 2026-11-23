---- MODULE UndoFrames ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) over a step that frames a layer.
\* Layers are numbered: 0 the slide, 1 frame F on the slide, 2 frame G in F, 3 the card K in G, 4 frame H on the
\* slide, and 5 the frame X a step makes. pK, pH and pX are the parents of K, H and X; pX is -1 while X is not made
\* or deleted. gone names the frame another tab deleted, F, G or H, or is 0.
\* Before the first press the person makes two steps: a drag of K, while it shows, into G or H when that frame
\* shows, or once, framing K (Ctrl+Alt+G): one edit makes X where K is and moves K into it. Once the person has a
\* step, another tab may act once, at any time: delete F, G or H, drag K into G, H or X, or drag H into X, each
\* while the layer and the frame show and the frame is not inside the layer.
\* Edits are numbered from 1 in the order they land. wK, wH and wX name the edit that wrote each parent last, others
\* is the set of the other tab's edits and turned the set of turns that landed, each as bits.
\* A step is a slot: 100 times its edit, 10 times where it puts K, or 9 for nowhere, and where it puts X: a layer,
\* 8 to delete X, or 9 to leave X. A stack is a number in base 8 whose last digit is the top step's slot: 1 and 2
\* for the person's steps, 3 to 5 for the step each landed turn pushed.
\* An undo writes each part of the top step whose parent was last written by the step or a turn that landed
\* (`invert`), and leaves out (`onStandingLayers` in packages/doom/src/standing-layers.ts) a move whose frame, or a
\* frame above it, is deleted, and the delete of a frame that would still hold a layer. With nothing left it takes
\* the step off and answers nothing. A turn that lands takes the step off and pushes on the other stack the step
\* that puts back what it wrote.
EXTENDS Integers

VARIABLES pK, pH, pX, wK, wH, wX, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told

vars == <<pK, pH, pX, wK, wH, wX, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told>>

Par(v) ==
  CASE v = 1 -> (IF gone = 1 THEN -1 ELSE 0)
    [] v = 2 -> (IF gone = 2 THEN -1 ELSE 1)
    [] v = 3 -> pK
    [] v = 4 -> (IF gone = 4 THEN -1 ELSE pH)
    [] v = 5 -> pX
    [] OTHER -> 0
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == Slot(k) \div 100
KTo(k) == (Slot(k) \div 10) % 10
XTo(k) == Slot(k) % 10
Pack(e, k, x) == 100 * e + 10 * k + x

\* Where a move of x into t ends when X's parent is px: "lands" when t and every frame above it stand and t is
\* not inside x, "cycle" when t is x or inside it, "missing" when t or a frame above it is deleted.
RECURSIVE Into(_, _, _, _)
Into(t, x, px, d) ==
  LET up == IF t = 5 THEN px ELSE Par(t) IN
  IF t = x \/ d = 0 THEN "cycle" ELSE IF t = 0 THEN "lands" ELSE IF up = -1 THEN "missing" ELSE Into(up, x, px, d - 1)
Shows(x) == Into(Par(x), x, pX, 6) = "lands"
Lands(x, t) == Into(t, x, pX, 6) = "lands"

Mine(w, k) == w = Edit(k) \/ In(turned, w)
\* The parts of slot k an undo writes, and of those the parts it leaves out.
OwnsX(k) == XTo(k) # 9 /\ Mine(wX, k)
OwnsK(k) == KTo(k) # 9 /\ Mine(wK, k)
PutsX(k) == OwnsX(k) /\ XTo(k) # 8 /\ Into(XTo(k), 5, pX, 6) = "lands"
XAfter(k) == IF PutsX(k) THEN XTo(k) ELSE pX
PutsK(k) == OwnsK(k) /\ Into(KTo(k), 3, XAfter(k), 6) = "lands"
KAfter(k) == IF PutsK(k) THEN KTo(k) ELSE pK
\* After the undo's moves X still holds K, because the undo left K's move out or someone moved K in after the
\* step, or holds H, which the other tab moved in after the step.
Holds(k) == (KAfter(k) = 5 /\ (OwnsK(k) \/ wK > Edit(k))) \/ (pH = 5 /\ gone # 4 /\ wH > Edit(k))
DeletesX(k) == OwnsX(k) /\ XTo(k) = 8 /\ ~Holds(k)
Writes(k) == PutsX(k) \/ PutsK(k) \/ DeletesX(k)

TypeOK ==
  /\ pK \in 0..5 /\ pH \in {0, 5} /\ pX \in -1..4 /\ {wK, wH, wX} \subseteq 0..7 /\ gone \in {0, 1, 2, 4}
  /\ n \in 0..7 /\ us \in 0..32767 /\ rs \in 0..32767
  /\ {s1, s2, s3, s4, s5} \subseteq 0..799
  /\ turned \in 0..255 /\ others \in 0..255
  /\ made \in 0..2 /\ turns \in 0..3 /\ acted \in BOOLEAN /\ presses \in 0..3
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo"}

Init ==
  /\ pK = 2 /\ pH = 0 /\ pX = -1 /\ wK = 0 /\ wH = 0 /\ wX = 0 /\ gone = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
  /\ turned = 0 /\ others = 0 /\ made = 0 /\ turns = 0 /\ acted = FALSE /\ presses = 0 /\ told = "none"

Drop(x, t) == Shows(x) /\ t # Par(x) /\ Lands(x, t)

Push(slot) ==
  /\ s1' = IF made = 0 THEN slot ELSE s1
  /\ s2' = IF made = 1 THEN slot ELSE s2
  /\ us' = us * 8 + made + 1 /\ rs' = 0
  /\ n' = n + 1 /\ made' = made + 1 /\ told' = "none"

PersonDrag ==
  \E t \in {2, 4} :
    /\ made < 2 /\ presses = 0 /\ Drop(3, t)
    /\ pK' = t /\ wK' = n + 1
    /\ Push(Pack(n + 1, pK, 9))
    /\ UNCHANGED <<pH, pX, wH, wX, gone, s3, s4, s5, turned, others, turns, acted, presses>>

PersonFrame ==
  /\ made < 2 /\ presses = 0 /\ wX = 0 /\ Shows(3)
  /\ pX' = pK /\ pK' = 5 /\ wX' = n + 1 /\ wK' = n + 1
  /\ Push(Pack(n + 1, pK, 8))
  /\ UNCHANGED <<pH, wH, gone, s3, s4, s5, turned, others, turns, acted, presses>>

Other == ~acted /\ made > 0 /\ others' = others + 2 ^ (n + 1) /\ n' = n + 1 /\ acted' = TRUE /\ told' = "none"
Unpressed == UNCHANGED <<us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

OtherDelete ==
  \E f \in {1, 2, 4} :
    /\ Other /\ gone' = f
    /\ Unpressed /\ UNCHANGED <<pK, pH, pX, wK, wH, wX>>

OtherDrag ==
  \E x \in {3, 4}, t \in {2, 4, 5} :
    /\ Other /\ (x = 4 => t = 5) /\ Drop(x, t)
    /\ pK' = IF x = 3 THEN t ELSE pK
    /\ wK' = IF x = 3 THEN n + 1 ELSE wK
    /\ pH' = IF x = 4 THEN t ELSE pH
    /\ wH' = IF x = 4 THEN n + 1 ELSE wH
    /\ Unpressed /\ UNCHANGED <<pX, wX, gone>>

\* Turn slot k: write the parts it puts back and fill the next turn slot with the step that writes them back again.
Turns(k) ==
  LET back == Pack(n + 1, IF PutsK(k) THEN pK ELSE 9, IF PutsX(k) THEN 8 ELSE IF DeletesX(k) THEN pX ELSE 9) IN
  /\ pK' = KAfter(k)
  /\ pX' = IF PutsX(k) THEN XTo(k) ELSE IF DeletesX(k) THEN -1 ELSE pX
  /\ wK' = IF PutsK(k) THEN n + 1 ELSE wK
  /\ wX' = IF PutsX(k) \/ DeletesX(k) THEN n + 1 ELSE wX
  /\ s3' = IF turns = 0 THEN back ELSE s3
  /\ s4' = IF turns = 1 THEN back ELSE s4
  /\ s5' = IF turns = 2 THEN back ELSE s5
  /\ turned' = turned + 2 ^ (n + 1)
  /\ n' = n + 1 /\ turns' = turns + 1

Kept == UNCHANGED <<pK, pX, wK, wX, n, s3, s4, s5, turned, turns>>

Undo ==
  /\ presses < 3 /\ us > 0
  /\ presses' = presses + 1
  /\ LET k == us % 8 IN
       IF Writes(k)
       THEN Turns(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
       ELSE us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
  /\ UNCHANGED <<pH, wH, gone, s1, s2, others, made, acted>>

Redo ==
  /\ presses < 3 /\ rs > 0
  /\ presses' = presses + 1
  /\ LET k == rs % 8 IN
       IF Writes(k)
       THEN Turns(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
       ELSE rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
  /\ UNCHANGED <<pH, wH, gone, s1, s2, others, made, acted>>

Next == PersonDrag \/ PersonFrame \/ OtherDelete \/ OtherDrag \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

Top == IF told' \in {"undone", "nothing to undo"} THEN us % 8 ELSE rs % 8
Pressed == presses' > presses

\* X is under a layer v: v sits in X, or in a frame that sits in X.
RECURSIVE Under(_, _, _)
Under(v, px, d) == LET up == IF v = 5 THEN px ELSE Par(v) IN
  IF d = 0 \/ up \in {-1, 0} THEN FALSE ELSE IF up = 5 THEN TRUE ELSE Under(up, px, d - 1)

\* A layer is never left inside a frame the press deletes, where no step brings it back.
NeverLosesALayer ==
  [][(Pressed /\ pX # -1 /\ pX' = -1) => \A v \in {3, 4} : ~(Under(v, pX, 6)' /\ Par(v)' # -1)]_vars

\* A press that finds nothing takes off only a step whose every part is spent: someone else wrote it since, its
\* frame is gone, or it would delete a frame that still holds a layer. A turn that lands puts K back where the
\* step found it, and K shows there.
NeverLosesAStep ==
  [][Pressed =>
     /\ told' \in {"nothing to undo", "nothing to redo"} => ~Writes(Top)
     /\ (told' \in {"undone", "redone"} /\ PutsK(Top)) => pK' = KTo(Top) /\ Shows(3)'
     /\ (told' \in {"undone", "redone"} /\ PutsX(Top)) => pX' = XTo(Top)]_vars

\* A turn never writes a parent the other tab wrote last.
NeverCoversTheirs ==
  [][/\ (wK' # wK /\ In(turned', wK')) => ~In(others, wK)
     /\ (wX' # wX /\ In(turned', wX')) => ~In(others, wX)
     /\ wH' = wH \/ ~In(turned', wH')]_vars

\* Every press takes a step off its stack, so the next press reaches the step below it.
NeverStuck == [][Pressed => <<us', rs'>> # <<us, rs>>]_vars

====
