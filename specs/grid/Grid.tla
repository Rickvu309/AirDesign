---- MODULE Grid ----
EXTENDS Integers, Sequences, FiniteSets
VARIABLES stage, slides, heads, cacheStage, cacheSlides, cacheHeads, initialized
vars == <<stage, slides, heads, cacheStage, cacheSlides, cacheHeads, initialized>>

Opening == <<1,2,3,4,5,6>>
Members(seq) == {seq[i] : i \in 1..Len(seq)}
RowStart(i) == CHOOSE j \in 1..i : slides[j] \in heads /\
  \A k \in (j+1)..i : slides[k] \notin heads
TypeOK ==
  /\ stage \in 0..48
  /\ slides \in Seq(1..8)
  /\ heads \subseteq Members(slides)
  /\ cacheStage \in 0..48
  /\ cacheSlides \in Seq(1..8)
  /\ cacheHeads \subseteq Members(cacheSlides)
Partition ==
  /\ Cardinality(Members(slides)) = Len(slides)
  /\ slides[1] \in heads
  /\ \A i \in 1..Len(slides) : RowStart(i) \in 1..i
NoEmptyRow == \A id \in heads : \E i \in 1..Len(slides) : slides[i] = id
HeadsUniqueOrdered == Cardinality(heads) = Cardinality({RowStart(i) : i \in 1..Len(slides)})
RowMajor == \A i,j \in 1..Len(slides) : i <= j => RowStart(i) <= RowStart(j)
SameAcceptedPrefix == cacheStage = stage => (cacheSlides = slides /\ cacheHeads = heads)
ForeignRowKept ==
  /\ stage = 3 => slides[RowStart(5)] = 1
  /\ stage \in {20,21,25} => slides[RowStart(5)] = 1
  /\ stage = 23 => slides[RowStart(6)] = 7
BelowSingleton ==
  /\ stage \in {15,17,18,20,28,29} =>
    /\ 7 \in heads
    /\ \A i \in 1..Len(slides) : slides[i] = 7 => (i = Len(slides) \/ slides[i+1] \in heads)
  /\ stage = 28 => 8 \in heads
Init ==
  /\ stage = 0 /\ slides = Opening /\ heads = {1,5}
  /\ cacheStage = 0 /\ cacheSlides = Opening /\ cacheHeads = {1,5}
  /\ initialized = FALSE
Land(from, to, order, starts) ==
  /\ stage = from /\ stage' = to /\ slides' = order /\ heads' = starts
  /\ initialized' = TRUE
  /\ UNCHANGED <<cacheStage, cacheSlides, cacheHeads>>
RemoveHead == Land(0,1,<<1,2,3,4,6>>,{1,6})
InsertGap == Land(1,2,<<1,2,3,4,7,6>>,{1,6})
RefuseHead == Land(2,3,<<1,2,3,4,7,6>>,{1,6})
RemoveSingleton == Land(1,4,<<1,2,3,4>>,{1})
UndoSingleton == Land(4,5,<<1,2,3,4,6>>,{1,6})
MoveHead == Land(0,6,<<1,2,5,3,4,6>>,{1,6})
UndoMove == Land(6,7,Opening,{1,5})
Add == Land(0,8,<<1,2,3,4,7,5,6>>,{1,5})
Clone == Land(0,9,<<1,2,3,4,5,7,6>>,{1,5})
UndoAdd == Land(8,10,Opening,{1,5})
UndoClone == Land(9,11,Opening,{1,5})
RemoveNonHead == Land(0,12,<<1,3,4,5,6>>,{1,5})
InsertNonHeadGap == Land(12,13,<<1,7,3,4,5,6>>,{1,5})
UndoNonHead == Land(13,14,<<1,2,7,3,4,5,6>>,{1,5})
BelowInterior == Land(0,15,<<1,2,3,4,7,5,6>>,{1,7,5})
UndoBelow == Land(15,16,Opening,{1,5})
RedoBelow == Land(16,17,<<1,2,3,4,7,5,6>>,{1,7,5})
BelowFinal == Land(0,18,<<1,2,3,4,5,6,7>>,{1,5,7})
TailAppend == Land(0,19,<<1,2,3,4,8,5,6>>,{1,5})
BelowAfterAppend == Land(19,20,<<1,2,3,4,8,7,5,6>>,{1,7,5})
UndoConcurrentBelow == Land(20,21,<<1,2,3,4,8,5,6>>,{1,5})
ForeignFillNew == Land(15,22,<<1,2,3,4,7,8,5,6>>,{1,7,5})
RefuseFilledUndo == Land(22,23,<<1,2,3,4,7,8,5,6>>,{1,7,5})
AppendAfterUndo == Land(16,24,<<1,2,3,4,8,5,6>>,{1,5})
RefuseRedo == Land(24,25,<<1,2,3,4,8,5,6>>,{1,5})
RemoveAnchor == Land(0,26,<<2,3,4,5,6>>,{2,5})
RefuseDeadBelow == Land(26,27,<<2,3,4,5,6>>,{2,5})
TwoBelow == Land(15,28,<<1,2,3,4,8,7,5,6>>,{1,8,7,5})
RefuseCollision == Land(15,29,<<1,2,3,4,7,5,6>>,{1,7,5})
GroupSame == Land(0,30,<<2,4,5,1,3,6>>,{2,5})
UndoGroup == Land(30,31,Opening,{1,5})
GroupNew == Land(0,32,<<2,4,5,6,1,3>>,{2,5,1})
RowKeep == Land(0,33,<<5,6,1,2,3,4>>,{5,1})
UndoRow == Land(33,34,Opening,{1,5})
RedoRow == Land(34,35,<<5,6,1,2,3,4>>,{5,1})
ForeignRowInsert == Land(33,36,<<5,7,6,1,2,3,4>>,{5,1})
RefuseRowUndo == Land(36,37,<<5,7,6,1,2,3,4>>,{5,1})
RefuseStaleRow == Land(9,38,<<1,2,3,4,5,7,6>>,{1,5})
ForeignGroupGap == Land(30,39,<<2,4,5,1,3,6,7>>,{2,5})
UndoForeignGroup == Land(39,40,<<1,2,3,4,5,6,7>>,{1,5})
EmptyRow == Land(0,41,<<1,2,5,6,3,4>>,{1})
RefuseGroupAnchor == Land(0,42,Opening,{1,5})
DeleteSet == Land(0,43,<<2,3,4>>,{2})
UndoDeleteSet == Land(43,44,Opening,{1,5})
CloneSet == Land(0,45,<<1,2,3,4,5,7,8,6>>,{1,5})
UndoCloneSet == Land(45,46,Opening,{1,5})
RefuseWholeDeck == Land(0,47,Opening,{1,5})
RefuseSetCollision == Land(45,48,<<1,2,3,4,5,7,8,6>>,{1,5})
Adopt ==
  /\ cacheStage # stage
  /\ cacheStage' = stage /\ cacheSlides' = slides /\ cacheHeads' = heads
  /\ UNCHANGED <<stage, slides, heads, initialized>>
Next == RemoveHead \/ InsertGap \/ RefuseHead \/ RemoveSingleton \/ UndoSingleton \/ MoveHead \/ UndoMove \/ Add \/ Clone \/ UndoAdd \/ UndoClone \/ RemoveNonHead \/ InsertNonHeadGap \/ UndoNonHead \/ BelowInterior \/ UndoBelow \/ RedoBelow \/ BelowFinal \/ TailAppend \/ BelowAfterAppend \/ UndoConcurrentBelow \/ ForeignFillNew \/ RefuseFilledUndo \/ AppendAfterUndo \/ RefuseRedo \/ RemoveAnchor \/ RefuseDeadBelow \/ TwoBelow \/ RefuseCollision \/ GroupSame \/ UndoGroup \/ GroupNew \/ RowKeep \/ UndoRow \/ RedoRow \/ ForeignRowInsert \/ RefuseRowUndo \/ RefuseStaleRow \/ ForeignGroupGap \/ UndoForeignGroup \/ EmptyRow \/ RefuseGroupAnchor \/ DeleteSet \/ UndoDeleteSet \/ CloneSet \/ UndoCloneSet \/ RefuseWholeDeck \/ RefuseSetCollision \/ Adopt
Spec == Init /\ [][Next]_vars
====
