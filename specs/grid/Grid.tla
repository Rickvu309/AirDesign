---- MODULE Grid ----
EXTENDS Integers, Sequences, FiniteSets
VARIABLES stage, slides, heads, cacheStage, cacheSlides, cacheHeads, initialized
vars == <<stage, slides, heads, cacheStage, cacheSlides, cacheHeads, initialized>>

Opening == <<1,2,3,4,5,6>>
Members(seq) == {seq[i] : i \in 1..Len(seq)}
RowStart(i) == CHOOSE j \in 1..i : slides[j] \in heads /\
  \A k \in (j+1)..i : slides[k] \notin heads
TypeOK ==
  /\ stage \in 0..14
  /\ slides \in Seq(1..7)
  /\ heads \subseteq Members(slides)
  /\ cacheStage \in 0..14
  /\ cacheSlides \in Seq(1..7)
  /\ cacheHeads \subseteq Members(cacheSlides)
Partition ==
  /\ Cardinality(Members(slides)) = Len(slides)
  /\ slides[1] \in heads
  /\ \A i \in 1..Len(slides) : RowStart(i) \in 1..i
NoEmptyRow == \A id \in heads : \E i \in 1..Len(slides) : slides[i] = id
HeadsUniqueOrdered == Cardinality(heads) = Cardinality({RowStart(i) : i \in 1..Len(slides)})
RowMajor == \A i,j \in 1..Len(slides) : i <= j => RowStart(i) <= RowStart(j)
SameAcceptedPrefix == cacheStage = stage => (cacheSlides = slides /\ cacheHeads = heads)
ForeignRowKept == stage = 3 => slides[RowStart(5)] = 1
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
Adopt ==
  /\ cacheStage # stage
  /\ cacheStage' = stage /\ cacheSlides' = slides /\ cacheHeads' = heads
  /\ UNCHANGED <<stage, slides, heads, initialized>>
Next == RemoveHead \/ InsertGap \/ RefuseHead \/ RemoveSingleton \/ UndoSingleton \/ MoveHead \/ UndoMove \/ Add \/ Clone \/ UndoAdd \/ UndoClone \/ RemoveNonHead \/ InsertNonHeadGap \/ UndoNonHead \/ Adopt
Spec == Init /\ [][Next]_vars
====
