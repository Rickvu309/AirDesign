---- MODULE LineEndBatches ----
\* One batch at a time lands on the server, from an agent or a tab, beside two shapes a line's end may attach to: X,
\* which a batch may take off the deck, and Y, which stays. A batch deletes X (parent null), moves X into a frame
\* already off the deck (shelve), or leaves X alone. With it, it may create the new line N, move the line L into
\* another frame, or turn the plain shape M into a line by a geometry write alone, the new start on X, on Y or free.
\* Or it may delete the frame F, or restore F to the deck, which brings back the line R inside it, whose start starts
\* on X and which the batch does not write. The server holds whether X is on the deck (xOn), L's start (s), once N exists (nOn) N's
\* start (ns), once M is a line (mOn) M's start (ms), whether F is on the deck (fOn) and R's start (rs). k, o, f and a
\* name the last batch, got says whether the server landed it, and agrees whether the server's partial fold left what
\* the whole deck's fold leaves.
\* The server judges a batch over a partial fold: the nodes the batch writes, the shapes their ends name, the lines
\* that name a shape the batch takes off the deck when it loads them, and the lines inside a frame the batch brings
\* back to the deck when it reads them.
\* Under Rule "refuseChecked", the deck refuses a batch that writes a parent and leaves an end it checks on a shape
\* off the deck: a line whose end named a shape the batch takes off the deck, or a line the batch creates or moves.
\* Under Rule "freeEvery", every batch lands. The deck frees each end on a shape off the deck of a line the batch
\* takes a shape from, writes a geometry or parent to, or brings back inside a frame (`freedInFold`), and the server
\* reads again for the lines inside a frame the fold shows coming back (`editDoom`).
EXTENDS Naturals

CONSTANT Rule

VARIABLES xOn, s, nOn, ns, mOn, ms, fOn, rs, sent, k, o, f, a, got, agrees

vars == <<xOn, s, nOn, ns, mOn, ms, fOn, rs, sent, k, o, f, a, got, agrees>>

Ends == {"X", "Y", "free"}
Kinds == {"none", "delete", "shelve"}
Ops == {"none", "newN", "moveL", "lineM"}
Frames == {"none", "drop", "restore"}

TypeOK ==
  /\ xOn \in BOOLEAN /\ nOn \in BOOLEAN /\ mOn \in BOOLEAN /\ fOn \in BOOLEAN /\ agrees \in BOOLEAN
  /\ s \in Ends /\ ns \in Ends /\ ms \in Ends /\ rs \in {"X", "free"} /\ sent \in 0..2
  /\ k \in Kinds /\ o \in Ops /\ f \in Frames /\ a \in Ends /\ got \in {"none", "landed", "refused"}

Dead(end, on) == end = "X" /\ ~on

\* What a batch (kk, oo, ff, aa) leaves on a fold that holds the lines naming X when loaded, and the lines inside F
\* when back.
Result(kk, oo, ff, aa, loaded, back) ==
  LET x == xOn /\ kk = "none"
      fAfter == IF ff = "none" THEN fOn ELSE ff = "restore"
      leaving == kk # "none"
      writesParent == leaving \/ oo \in {"newN", "moveL"} \/ ff # "none"
      checks == Rule = "freeEvery" \/ writesParent
      sAfter == IF oo = "moveL" THEN aa ELSE s
      nsAfter == IF oo = "newN" THEN aa ELSE ns
      msAfter == IF oo = "lineM" THEN aa ELSE ms
      nAfter == nOn \/ oo = "newN"
      mAfter == mOn \/ oo = "lineM"
      cL == checks /\ ((leaving /\ s = "X" /\ (loaded \/ oo = "moveL")) \/ oo = "moveL")
      cN == checks /\ ((leaving /\ nOn /\ ns = "X" /\ (loaded \/ oo = "newN")) \/ oo = "newN")
      cM == checks /\ ((leaving /\ mOn /\ ms = "X" /\ (loaded \/ oo = "lineM")) \/ oo = "lineM")
      cR == checks /\ ((leaving /\ fOn /\ rs = "X" /\ loaded) \/ (Rule = "freeEvery" /\ ~fOn /\ ff = "restore" /\ back))
      deadL == cL /\ Dead(sAfter, x)
      deadN == cN /\ nAfter /\ Dead(nsAfter, x)
      deadM == cM /\ mAfter /\ Dead(msAfter, x)
      deadR == cR /\ fAfter /\ Dead(rs, x)
      Freed(end, dead) == IF dead THEN "free" ELSE end
      refused == Rule = "refuseChecked" /\ (deadL \/ deadN \/ deadM \/ deadR)
  IN IF refused
       THEN [got |-> "refused", xOn |-> xOn, s |-> s, nOn |-> nOn, ns |-> ns, mOn |-> mOn, ms |-> ms, fOn |-> fOn,
             rs |-> rs]
       ELSE [got |-> "landed", xOn |-> x, s |-> Freed(sAfter, deadL), nOn |-> nAfter, ns |-> Freed(nsAfter, deadN),
             mOn |-> mAfter, ms |-> Freed(msAfter, deadM), fOn |-> fAfter, rs |-> Freed(rs, deadR)]

Loads(kk) == kk \in {"delete", "shelve"}
ReadsBack == Rule = "freeEvery"

Send ==
  /\ sent < 2
  /\ \E kk \in Kinds, oo \in Ops, ff \in Frames, aa \in Ends :
       /\ kk # "none" => xOn
       /\ oo = "newN" => ~nOn
       /\ oo = "lineM" => ~mOn
       /\ oo = "none" => aa = "free"
       /\ ff = "drop" => fOn
       /\ ff = "restore" => ~fOn
       /\ ff # "none" => oo = "none"
       /\ kk = "none" /\ ff = "none" => oo # "none"
       /\ LET r == Result(kk, oo, ff, aa, Loads(kk), ReadsBack) IN
            /\ k' = kk /\ o' = oo /\ f' = ff /\ a' = aa /\ sent' = sent + 1
            /\ got' = r.got /\ agrees' = (r = Result(kk, oo, ff, aa, TRUE, TRUE))
            /\ xOn' = r.xOn /\ s' = r.s /\ nOn' = r.nOn /\ ns' = r.ns /\ mOn' = r.mOn /\ ms' = r.ms /\ fOn' = r.fOn
            /\ rs' = r.rs

Init ==
  /\ xOn = TRUE /\ s \in Ends /\ nOn = FALSE /\ ns = "free" /\ mOn = FALSE /\ ms = "free" /\ fOn = TRUE
  /\ rs = "X" /\ sent = 0
  /\ k = "none" /\ o = "none" /\ f = "none" /\ a = "free" /\ got = "none" /\ agrees = TRUE

Next == Send

Spec == Init /\ [][Next]_vars

\* No line on the deck names a shape that is not on the deck.
NoDeadEnd == ~Dead(s, xOn) /\ (nOn => ~Dead(ns, xOn)) /\ (mOn => ~Dead(ms, xOn)) /\ (fOn => ~Dead(rs, xOn))

\* The server's partial fold leaves what the whole deck's fold leaves.
PartialAgrees == agrees

\* Every batch lands: no line end ever makes the deck refuse one.
NeverRefused == got # "refused"

\* A delete wins: once a batch takes X off the deck, X is off it.
DeletesWin == [][k' # "none" => ~xOn']_vars

====
