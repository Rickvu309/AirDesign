---- MODULE UndoMoves ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) over moves between nested frames.
\* Layers are numbered: 0 the slide, 1 frame F and 4 frame H on the slide, 2 frame G in F and 3 frame J in G.
\* pG and pJ are the parents of G and J. gone names the frame another tab deleted, F or H, or is 0.
\* Before the first press the person makes two steps, each moving G or J, while it shows, into the slide or a
\* frame that shows and is not inside it, as the editor lets a drag drop it. Once the person has a step, another
\* tab may act once, at any time: delete F or H, or move G or J the same way.
\* Edits are numbered from 1 in the order they land. wG and wJ name the edit that wrote each parent last, others is
\* the set of the other tab's edits and turned the set of turns that landed, each as bits.
\* An undo looks at the top step. When its layer's parent was last written by the step or a turn that landed, it
\* puts back the parent the step replaced, if that frame stands and is not inside the layer, and, while the layer
\* shows, every frame above it stands too (`onStandingLayers` in packages/doom/src/standing-layers.ts): a layer
\* that does not show goes back under a deleted frame and comes back with it. Otherwise it takes the step off the
\* stack and answers nothing, as Figma does nothing for an undo of a move into a frame that is gone. A turn that
\* lands takes the step off and pushes on the redo stack a step that wrote what it put back. A redo does the same
\* from the redo stack.
\* A stack is a number in base 8 whose last digit is the top step's slot: 1 and 2 for the person's steps, 3 to 5
\* for the step each landed turn pushed. A slot holds 100 times the step's edit, 10 times the layer it moved and
\* the parent it replaced.
EXTENDS Integers

VARIABLES pG, pJ, wG, wJ, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told

vars == <<pG, pJ, wG, wJ, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told>>

Movable == {2, 3}
Layers == 0..4
Targets == {2, 3, 4}
Par(v) == CASE v = 2 -> pG [] v = 3 -> pJ [] v = 1 \/ v = 4 -> (IF gone = v THEN -1 ELSE 0) [] OTHER -> -2
W(x) == IF x = 2 THEN wG ELSE wJ
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == Slot(k) \div 100
Node(k) == (Slot(k) \div 10) % 10
Replaced(k) == Slot(k) % 10
Pack(e, x, p) == 100 * e + 10 * x + p

\* Where a move of x into t ends: "lands" when t and every frame above it stand and t is not inside x, "cycle"
\* when t is x or inside it, "missing" when t or a frame above it is deleted.
RECURSIVE Into(_, _, _)
Into(t, x, d) ==
  IF t = x \/ d = 0 THEN "cycle" ELSE IF t = 0 THEN "lands" ELSE IF Par(t) = -1 THEN "missing" ELSE Into(Par(t), x, d - 1)
Shows(x) == Into(Par(x), x, 5) = "lands"
Lands(x, t) == Into(t, x, 5) = "lands"
Back(x, t) == IF Shows(x) THEN Lands(x, t) ELSE Into(t, x, 5) # "cycle" /\ Par(t) # -1

Owned(k) == W(Node(k)) = Edit(k) \/ In(turned, W(Node(k)))
Puts(k) == Owned(k) /\ Back(Node(k), Replaced(k))

TypeOK ==
  /\ {pG, pJ} \subseteq Layers /\ {wG, wJ} \subseteq 0..7 /\ gone \in {0, 1, 4} /\ n \in 0..7
  /\ us \in 0..32767 /\ rs \in 0..32767
  /\ {s1, s2, s3, s4, s5} \subseteq 0..734
  /\ turned \in 0..255 /\ others \in 0..255
  /\ made \in 0..2 /\ turns \in 0..3 /\ acted \in BOOLEAN /\ presses \in 0..3
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo", "undo refused", "redo refused"}

Init ==
  /\ pG = 1 /\ pJ = 2 /\ wG = 0 /\ wJ = 0 /\ gone = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
  /\ turned = 0 /\ others = 0 /\ made = 0 /\ turns = 0 /\ acted = FALSE /\ presses = 0 /\ told = "none"

Moves(x, t, by) ==
  /\ pG' = IF x = 2 THEN t ELSE pG
  /\ pJ' = IF x = 3 THEN t ELSE pJ
  /\ wG' = IF x = 2 THEN by ELSE wG
  /\ wJ' = IF x = 3 THEN by ELSE wJ

Drop(x, t) == Shows(x) /\ t # Par(x) /\ Lands(x, t)

PersonStep ==
  \E x \in Movable, t \in Targets :
    /\ made < 2 /\ presses = 0 /\ Drop(x, t)
    /\ Moves(x, t, n + 1)
    /\ s1' = IF made = 0 THEN Pack(n + 1, x, Par(x)) ELSE s1
    /\ s2' = IF made = 1 THEN Pack(n + 1, x, Par(x)) ELSE s2
    /\ us' = us * 8 + made + 1 /\ rs' = 0
    /\ n' = n + 1 /\ made' = made + 1 /\ told' = "none"
    /\ UNCHANGED <<gone, s3, s4, s5, turned, others, turns, acted, presses>>

OtherDelete ==
  \E f \in {1, 4} :
    /\ ~acted /\ made > 0
    /\ gone' = f
    /\ others' = others + 2 ^ (n + 1)
    /\ n' = n + 1 /\ acted' = TRUE /\ told' = "none"
    /\ UNCHANGED <<pG, pJ, wG, wJ, us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

OtherMove ==
  \E x \in Movable, t \in Targets :
    /\ ~acted /\ made > 0 /\ Drop(x, t)
    /\ Moves(x, t, n + 1)
    /\ others' = others + 2 ^ (n + 1)
    /\ n' = n + 1 /\ acted' = TRUE /\ told' = "none"
    /\ UNCHANGED <<gone, us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

\* Turn the step in slot k: put its layer back and fill the next turn slot with the step that moves it back again.
Turns(k) ==
  LET back == Pack(n + 1, Node(k), Par(Node(k))) IN
  /\ Moves(Node(k), Replaced(k), n + 1)
  /\ s3' = IF turns = 0 THEN back ELSE s3
  /\ s4' = IF turns = 1 THEN back ELSE s4
  /\ s5' = IF turns = 2 THEN back ELSE s5
  /\ turned' = turned + 2 ^ (n + 1)
  /\ n' = n + 1 /\ turns' = turns + 1

Kept == UNCHANGED <<pG, pJ, wG, wJ, n, s3, s4, s5, turned, turns>>

Undo ==
  /\ presses < 3 /\ us > 0
  /\ presses' = presses + 1
  /\ LET k == us % 8 IN
       IF Puts(k)
       THEN Turns(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
       ELSE us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
  /\ UNCHANGED <<gone, s1, s2, others, made, acted>>

Redo ==
  /\ presses < 3 /\ rs > 0
  /\ presses' = presses + 1
  /\ LET k == rs % 8 IN
       IF Puts(k)
       THEN Turns(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
       ELSE rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
  /\ UNCHANGED <<gone, s1, s2, others, made, acted>>

Next == PersonStep \/ OtherDelete \/ OtherMove \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

\* Nothing of the step can come back: someone else moved its layer since, or the frame it came from is gone or
\* now sits inside the layer, or, while the layer shows, a frame above that frame is gone.
Spent(k) == ~Owned(k) \/ ~Back(Node(k), Replaced(k))

\* A press that finds nothing to put back takes off only a spent step, and a turn that lands puts the layer back
\* where the step found it, where it shows if it showed before.
NeverLosesAStep ==
  [][/\ (told' = "nothing to undo" /\ us > 0) => Spent(us % 8)
     /\ (told' = "nothing to redo" /\ rs > 0) => Spent(rs % 8)
     /\ (told' = "undone" /\ us > 0) =>
          \A x \in {Node(us % 8)} : Par(x)' = Replaced(us % 8) /\ (Shows(x) => Shows(x)')
     /\ (told' = "redone" /\ rs > 0) =>
          \A x \in {Node(rs % 8)} : Par(x)' = Replaced(rs % 8) /\ (Shows(x) => Shows(x)')]_vars

\* A turn never moves a layer the other tab moved last.
NeverCoversTheirs ==
  [][\A x \in Movable : (W(x)' # W(x) /\ In(turned', W(x)')) => ~In(others, W(x))]_vars

\* Every press takes a step off its stack, so the next press reaches the step below it: a frame that is gone or
\* now sits inside the layer never holds the steps under it.
NeverStuck == [][presses' > presses => <<us', rs'>> # <<us, rs>>]_vars

====
