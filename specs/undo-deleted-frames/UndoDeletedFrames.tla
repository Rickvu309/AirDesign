---- MODULE UndoDeletedFrames ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) over steps on a card whose frame,
\* or the frame above it, another tab deletes and may bring back.
\* Layers are numbered: 0 the slide, 1 frame F on the slide, 2 frame G in F, 3 the card K in G, 4 frame H on the
\* slide. pK is K's parent, or -1 while K is deleted, and cK its colour, 0 or 1, which stands for every write that
\* does not place K in its frame: a fill, its words, its size. gone names the frame another tab deleted, F or G,
\* or is 0.
\* Before the first press the person makes two steps, each while K shows: a drag of K into H, which may also paint
\* K in the same edit, as one edit of an agent run can, or a delete of K. Once the person has a step, another tab
\* may act once: delete F or G, or paint K while it shows. After its delete it may press Ctrl+Z once, which brings
\* the frame back.
\* Edits are numbered from 1 in the order they land. wK and wC name the edit that wrote K's parent and colour last,
\* others is the set of the other tab's edits and turned the set of turns that landed, each as bits.
\* A step is a slot: 100 times the colour it replaced plus 1, or 0 when it paints nothing, 10 times its edit, and
\* where it puts K: a frame, 8 to delete K, or 9 to leave K. A stack is a number in base 8 whose last digit is the
\* top step's slot: 1 and 2 for the person's steps, 3 to 5 for the step each landed turn pushed.
\* An undo writes each part of the top step whose last writer is the step or a turn that landed (`invert`). It
\* leaves out (`onStandingLayers` in packages/doom/src/standing-layers.ts) a move of K into a deleted frame, or,
\* while K shows, into a frame under a deleted one, so the undo never hides K; a K that does not show goes back
\* under the deleted frame and comes back with it, and a deleted K goes back even into the deleted frame itself
\* (`write` in packages/doom/src/apply-edit.ts), so it comes back when that frame does. It puts K's colour back while K stands or comes back in the same
\* undo, whether or not its move lands. With nothing left it takes the step off and answers nothing. A turn that
\* lands takes the step off and pushes on the other stack the step that puts back what it wrote.
EXTENDS Integers

VARIABLES pK, cK, wK, wC, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acts, presses,
  told

vars == <<pK, cK, wK, wC, gone, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, acts, presses,
  told>>

Par(v) == CASE v = 1 -> (IF gone = 1 THEN -1 ELSE 0) [] v = 2 -> (IF gone = 2 THEN -1 ELSE 1) [] OTHER -> 0
\* Frame t and every frame above it stand.
Stands(t) == t = 0 \/ t = 4 \/ (t = 1 /\ gone # 1) \/ (t = 2 /\ gone = 0)
Shows == pK # -1 /\ Stands(pK)
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Look(k) == Slot(k) \div 100
Edit(k) == (Slot(k) \div 10) % 10
KTo(k) == Slot(k) % 10
Pack(c, e, k) == 100 * c + 10 * e + k

Mine(w, k) == w = Edit(k) \/ In(turned, w)
OwnsK(k) == KTo(k) # 9 /\ Mine(wK, k)
OwnsC(k) == Look(k) # 0 /\ Mine(wC, k)
\* Where the undo may put K back into frame t: where K shows, or, while K does not show, into a frame that
\* stands itself, though a frame above it is deleted, and, while K is deleted, into a deleted frame too.
Back(t) == IF Shows THEN Stands(t) ELSE pK = -1 \/ Par(t) # -1
PutsK(k) == OwnsK(k) /\ (KTo(k) = 8 \/ Back(KTo(k)))
KAfter(k) == IF PutsK(k) THEN (IF KTo(k) = 8 THEN -1 ELSE KTo(k)) ELSE pK
Paints(k) == OwnsC(k) /\ (pK # -1 \/ PutsK(k))
Writes(k) == PutsK(k) \/ Paints(k)

TypeOK ==
  /\ pK \in -1..4 /\ cK \in 0..1 /\ {wK, wC} \subseteq 0..7 /\ gone \in {0, 1, 2}
  /\ n \in 0..7 /\ us \in 0..32767 /\ rs \in 0..32767 /\ {s1, s2, s3, s4, s5} \subseteq 0..279
  /\ turned \in 0..255 /\ others \in 0..255
  /\ made \in 0..2 /\ turns \in 0..3 /\ acts \in 0..2 /\ presses \in 0..3
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo"}

Init ==
  /\ pK = 2 /\ cK = 0 /\ wK = 0 /\ wC = 0 /\ gone = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
  /\ turned = 0 /\ others = 0 /\ made = 0 /\ turns = 0 /\ acts = 0 /\ presses = 0 /\ told = "none"

Paint(paints, by) ==
  /\ cK' = IF paints THEN 1 - cK ELSE cK
  /\ wC' = IF paints THEN by ELSE wC

Push(slot) ==
  /\ s1' = IF made = 0 THEN slot ELSE s1
  /\ s2' = IF made = 1 THEN slot ELSE s2
  /\ us' = us * 8 + made + 1 /\ rs' = 0
  /\ n' = n + 1 /\ made' = made + 1 /\ told' = "none"

PersonStep ==
  \E t \in {-1, 4}, paints \in BOOLEAN :
    /\ made < 2 /\ presses = 0 /\ Shows /\ t # pK /\ (t = -1 \/ Stands(t)) /\ (paints => t # -1)
    /\ pK' = t /\ wK' = n + 1 /\ Paint(paints, n + 1)
    /\ Push(Pack(IF paints THEN 1 + cK ELSE 0, n + 1, pK))
    /\ UNCHANGED <<gone, s3, s4, s5, turned, others, turns, acts, presses>>

Other == others' = others + 2 ^ (n + 1) /\ n' = n + 1 /\ told' = "none"
Unpressed == UNCHANGED <<pK, wK, us, rs, s1, s2, s3, s4, s5, turned, made, turns, presses>>

OtherDelete ==
  \E f \in {1, 2} :
    /\ acts = 0 /\ made > 0 /\ gone' = f /\ acts' = 1
    /\ Other /\ Unpressed /\ UNCHANGED <<cK, wC>>

OtherPaint ==
  /\ acts = 0 /\ made > 0 /\ Shows /\ acts' = 2
  /\ Paint(TRUE, n + 1)
  /\ Other /\ Unpressed /\ UNCHANGED gone

OtherUndo ==
  /\ acts = 1 /\ gone' = 0 /\ acts' = 2
  /\ Other /\ Unpressed /\ UNCHANGED <<cK, wC>>

\* Turn slot k: write the parts it puts back and fill the next turn slot with the step that writes them back again.
Turns(k) ==
  LET back == Pack(IF Paints(k) THEN 1 + cK ELSE 0, n + 1, IF PutsK(k) THEN (IF pK = -1 THEN 8 ELSE pK) ELSE 9) IN
  /\ pK' = KAfter(k)
  /\ wK' = IF PutsK(k) THEN n + 1 ELSE wK
  /\ cK' = IF Paints(k) THEN Look(k) - 1 ELSE cK
  /\ wC' = IF Paints(k) THEN n + 1 ELSE wC
  /\ s3' = IF turns = 0 THEN back ELSE s3
  /\ s4' = IF turns = 1 THEN back ELSE s4
  /\ s5' = IF turns = 2 THEN back ELSE s5
  /\ turned' = turned + 2 ^ (n + 1)
  /\ n' = n + 1 /\ turns' = turns + 1

Kept == UNCHANGED <<pK, cK, wK, wC, n, s3, s4, s5, turned, turns>>

Undo ==
  /\ presses < 3 /\ us > 0
  /\ presses' = presses + 1
  /\ LET k == us % 8 IN
       IF Writes(k)
       THEN Turns(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
       ELSE us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
  /\ UNCHANGED <<gone, s1, s2, others, made, acts>>

Redo ==
  /\ presses < 3 /\ rs > 0
  /\ presses' = presses + 1
  /\ LET k == rs % 8 IN
       IF Writes(k)
       THEN Turns(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
       ELSE rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
  /\ UNCHANGED <<gone, s1, s2, others, made, acts>>

Next == PersonStep \/ OtherDelete \/ OtherPaint \/ OtherUndo \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

Top == IF told' \in {"undone", "nothing to undo"} THEN us % 8 ELSE rs % 8
Pressed == presses' > presses

\* A step on the stack would bring a deleted K back.
RECURSIVE Restores(_)
Restores(stack) == stack > 0 /\ (LET k == stack % 8 IN (KTo(k) \notin {8, 9} /\ Mine(wK, k)) \/ Restores(stack \div 8))

\* When the other tab brings back the frame it deleted, a K the person deleted comes back with it, or a step on the
\* person's stacks still brings it back, the frame the person deleted K from among them.
NeverLosesALayer ==
  [][(acts = 1 /\ acts' = 2 /\ pK = -1) => Restores(us) \/ Restores(rs)]_vars

\* A press on a step that changed K's colour puts it back, whatever happens to K's move, unless someone else
\* changed it since or K stays deleted.
NeverDropsAVisibleEdit == [][(Pressed /\ OwnsC(Top) /\ pK' # -1) => cK' = Look(Top) - 1]_vars

\* A press that finds nothing takes off only a step whose every part is spent, and a turn that puts K back puts it
\* where the step found it, where it shows if it showed before.
NeverLosesAStep ==
  [][Pressed =>
     /\ told' \in {"nothing to undo", "nothing to redo"} => ~Writes(Top)
     /\ (told' \in {"undone", "redone"} /\ PutsK(Top)) =>
          /\ pK' = (IF KTo(Top) = 8 THEN -1 ELSE KTo(Top))
          /\ (KTo(Top) # 8 /\ Shows) => Shows']_vars

\* A turn never writes what the other tab wrote last.
NeverCoversTheirs ==
  [][/\ (wK' # wK /\ In(turned', wK')) => ~In(others, wK)
     /\ (wC' # wC /\ In(turned', wC')) => ~In(others, wC)]_vars

\* Every press takes a step off its stack, so the next press reaches the step below it.
NeverStuck == [][Pressed => <<us', rs'>> # <<us, rs>>]_vars

====
