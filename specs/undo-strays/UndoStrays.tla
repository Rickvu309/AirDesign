---- MODULE UndoStrays ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) over steps on the card K's place, beside
\* a move by another writer. The slide holds frame F, and K is in F or on the slide. p is K's parent, 1 for F and 0 for
\* the slide. x is K's x in its parent; F sits 2 to the right, so K is seen at x + 2 in F and at x on the slide.
\* Edits are numbered from 1 in the order they land. wp and wx name the edit that wrote K's parent and x last, others is
\* the set of the other writer's edits and turned the set of presses that landed, each as bits.
\* Before the first press the person makes two steps while K sits in F or on the slide: a nudge, which writes x, or a drag,
\* which writes the parent and x, as a person's move into another frame does. Once the person has a step, another
\* writer may act once, at any time: move K to the other parent with no new x, as an agent's move does, or write x.
\* An undo looks at the top step. It writes x when the step or a press that landed wrote it last, and the parent when it is
\* a drag and wrote the parent last (`invert` in packages/doom/src/invert.ts). When it writes x but not the parent, and
\* K no longer sits in the frame the step left it in, it keeps x as it is (`onStandingLayers` in
\* packages/doom/src/standing-layers.ts), as for a move it leaves out. With nothing to write it takes the step off and
\* answers nothing. A press that lands pushes on the other stack a step that writes back what it replaced. A redo does
\* the same from the redo stack.
\* A stack is a number in base 8 whose last digit is the top step's slot: 1 and 2 for the person's steps, 3 to 5 for the
\* step each landed press pushed. A slot holds the edit, 8 if it wrote the parent, 16 times the x it replaced, 64 times the
\* parent it replaced and 128 times the parent it left K in.
EXTENDS Integers

VARIABLES p, x, wp, wx, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told

vars == <<p, x, wp, wx, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acted, presses, told>>

Fixed == TRUE

In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == Slot(k) % 8
Wrote(k) == (Slot(k) \div 8) % 2 = 1
Replaced(k) == (Slot(k) \div 16) % 4
Before(k) == (Slot(k) \div 64) % 2
LeftIn(k) == (Slot(k) \div 128) % 2
Pack(e, w, rx, rp, lp) == e + 8 * w + 16 * rx + 64 * rp + 128 * lp
Seen == x + 2 * p

OwnsX(k) == wx = Edit(k) \/ In(turned, wx)
OwnsP(k) == Wrote(k) /\ (wp = Edit(k) \/ In(turned, wp))
Strays(k) == Fixed /\ ~OwnsP(k) /\ p # LeftIn(k)
WritesX(k) == OwnsX(k) /\ ~Strays(k)
Lands(k) == WritesX(k) \/ OwnsP(k)

TypeOK ==
  /\ p \in 0..1 /\ x \in 0..1 /\ {wp, wx} \subseteq 0..7 /\ n \in 0..7
  /\ us \in 0..32767 /\ rs \in 0..32767
  /\ {s1, s2, s3, s4, s5} \subseteq 0..255
  /\ turned \in 0..255 /\ others \in 0..255
  /\ made \in 0..2 /\ turns \in 0..3 /\ acted \in BOOLEAN /\ presses \in 0..3
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo"}

Init ==
  /\ p = 1 /\ x = 0 /\ wp = 0 /\ wx = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
  /\ turned = 0 /\ others = 0 /\ made = 0 /\ turns = 0 /\ acted = FALSE /\ presses = 0 /\ told = "none"

Stepped(slot) ==
  /\ s1' = IF made = 0 THEN slot ELSE s1
  /\ s2' = IF made = 1 THEN slot ELSE s2
  /\ us' = us * 8 + made + 1 /\ rs' = 0
  /\ n' = n + 1 /\ made' = made + 1 /\ told' = "none"
  /\ UNCHANGED <<s3, s4, s5, turned, others, turns, acted, presses>>

Nudge ==
  \E nx \in 0..1 :
    /\ made < 2 /\ presses = 0 /\ nx # x
    /\ x' = nx /\ wx' = n + 1
    /\ Stepped(Pack(n + 1, 0, x, p, p))
    /\ UNCHANGED <<p, wp>>

Drag ==
  \E np \in 0..1, nx \in 0..1 :
    /\ made < 2 /\ presses = 0 /\ np # p /\ nx # x
    /\ p' = np /\ x' = nx /\ wp' = n + 1 /\ wx' = n + 1
    /\ Stepped(Pack(n + 1, 1, x, p, np))

OtherMove ==
  /\ ~acted /\ made > 0
  /\ p' = 1 - p /\ wp' = n + 1
  /\ others' = others + 2 ^ (n + 1)
  /\ n' = n + 1 /\ acted' = TRUE /\ told' = "none"
  /\ UNCHANGED <<x, wx, us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

OtherWrite ==
  \E nx \in 0..1 :
    /\ ~acted /\ made > 0 /\ nx # x
    /\ x' = nx /\ wx' = n + 1
    /\ others' = others + 2 ^ (n + 1)
    /\ n' = n + 1 /\ acted' = TRUE /\ told' = "none"
    /\ UNCHANGED <<p, wp, us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

\* Press on the step in slot k: write what it owns and fill the next slot with the step that writes it back.
Turns(k) ==
  LET np == IF OwnsP(k) THEN Before(k) ELSE p
      nx == IF WritesX(k) THEN Replaced(k) ELSE x
      back == Pack(n + 1, IF OwnsP(k) THEN 1 ELSE 0, x, p, np) IN
  /\ p' = np /\ x' = nx
  /\ wp' = IF OwnsP(k) THEN n + 1 ELSE wp
  /\ wx' = IF WritesX(k) THEN n + 1 ELSE wx
  /\ s3' = IF turns = 0 THEN back ELSE s3
  /\ s4' = IF turns = 1 THEN back ELSE s4
  /\ s5' = IF turns = 2 THEN back ELSE s5
  /\ turned' = turned + 2 ^ (n + 1)
  /\ n' = n + 1 /\ turns' = turns + 1

Kept == UNCHANGED <<p, x, wp, wx, n, s3, s4, s5, turned, turns>>

Undo ==
  /\ presses < 3 /\ us > 0
  /\ presses' = presses + 1
  /\ LET k == us % 8 IN
       IF Lands(k)
       THEN Turns(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
       ELSE us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
  /\ UNCHANGED <<s1, s2, others, made, acted>>

Redo ==
  /\ presses < 3 /\ rs > 0
  /\ presses' = presses + 1
  /\ LET k == rs % 8 IN
       IF Lands(k)
       THEN Turns(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
       ELSE rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
  /\ UNCHANGED <<s1, s2, others, made, acted>>

Next == Nudge \/ Drag \/ OtherMove \/ OtherWrite \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

\* A press that lands never moves K away from where the person saw it, unless it writes K's parent or K still sits in the
\* frame the step left it in.
PutsBackWhereSeen ==
  [][\A k \in {IF told' = "undone" THEN us % 8 ELSE rs % 8} :
       (told' \in {"undone", "redone"} /\ Seen' # Seen) => (p' # p \/ wp' # wp \/ p = LeftIn(k))]_vars

\* A press never writes the x the other writer wrote last.
NeverCoversTheirs ==
  [][(wx' # wx /\ In(turned', wx')) => ~In(others, wx)]_vars

\* Every press takes a step off its stack, so the next press reaches the step below it.
NeverStuck == [][presses' > presses => <<us', rs'>> # <<us, rs>>]_vars

====
