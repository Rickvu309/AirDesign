---- MODULE Tabs ----
\* Two tabs of one browser have the same deck open. They share one copy of it in IndexedDB
\* (packages/live): pending rows, the confirmed rows that mirror the server, the revision those
\* rows hold, and a head that changeHeld in held.ts reads in the same transaction as its write,
\* so a tab whose memory missed the other tab's write reads the copy again before it writes. A
\* tab learns of the other tab's edits only through the server: its follow sees a newer
\* revision, reads the deck and writes it into the copy (adopt in cache.ts), then paints the
\* copy.
\* The deck holds one text box with the file's words. The first tab moves it; the second tab
\* then makes its words bold in the design panel, planned against the copy. A row that adds the
\* box to the copy carries the file's words under it, its floor. Kept says a confirmed row keeps
\* that floor (fitConfirmed and rowsFromRegister since PR 549).
\* The first tab stays on the build it loaded, the older one. The second tab may reload once,
\* into the same build or into a newer one. A newer page opens IndexedDB at its higher version
\* when it paints the copy, before any row of its own can reach the server, so the older tab
\* meets it at its next transaction (VersionError) or its next read of the deck (readRegister
\* answers newer for a row stamped past its format). Either way the older tab shows the
\* newer-version notice and writes nothing more (markNewer and unlessNewer in device.ts and
\* cache.ts).
\* mv and fm are the pending rows of the move and the bold, row or sealed with a once; mvc and
\* fmc say the copy holds them as confirmed rows. together says one once sealed both. words is
\* what the bold row sets: bold words, or none when it was planned against an empty box.
\* floored says the bold row carries the floor, as it does when the copy did not hold the box.
\* older says the older tab wrote to the copy after a newer build opened it. crev is the
\* revision the copy says it holds. wrote2 says the second tab's page wrote the bold row that is
\* still pending (pageEdits in device.ts); a reload forgets it.
\* mvAt and fmAt are the revisions they landed at on the server, 0 before. knownN is the
\* revision tab N's mirror holds by its own account (known in connect), -1 on a page that has
\* not read the deck. asked2 is the server's answer to a page's open that the page has not
\* written into the copy yet. shownN is what tab N's canvas paints, "" for the notice.
EXTENDS Integers

VARIABLES made, mv, mvc, fm, fmc, together, words, floored, older, crev,
          rev, mvAt, fmAt, version, reloads,
          stopped1, wire1, batch1, known1, shown1,
          build2, wire2, batch2, known2, asked2, shown2, wrote2

Rows == <<made, mv, mvc, fm, fmc, together, words, floored, older, crev>>
Server == <<rev, mvAt, fmAt>>
One == <<stopped1, wire1, batch1, known1, shown1>>
Two == <<build2, wire2, batch2, known2, asked2, shown2, wrote2>>
vars == <<Rows, Server, version, reloads, One, Two>>

Reloads == 1
Kept == TRUE

Texts == {"file", "bold", "none"}

Deck(moved, text) ==
  IF ~moved THEN text
  ELSE CASE text = "file" -> "moved file" [] text = "bold" -> "moved bold" [] OTHER -> "moved none"

Shown == {""} \cup {Deck(m, t) : m \in BOOLEAN, t \in Texts}

MovedAt(r) == mvAt > 0 /\ mvAt <= r
BoldAt(r) == fmAt > 0 /\ fmAt <= r
ServerDeck == Deck(MovedAt(rev), IF BoldAt(rev) THEN words ELSE "file")

\* played in deck-view.ts rebuilds the box from the copy's rows: the confirmed rows first, then
\* each pending row whose base is the box's version so far (staleText in slide-replay.ts skips
\* the others). The box's words are the floor of the first row that adds it, or none when that
\* row carries no floor.
Moves == mvc \/ mv # "none"
BoldShows == fmc \/ (fm # "none" /\ floored = ~Moves)
Floor ==
  IF mvc THEN IF Kept THEN "file" ELSE "none"
  ELSE IF mv # "none" \/ fm = "none" \/ floored THEN "file"
  ELSE "none"
CopyText == IF BoldShows THEN words ELSE Floor
Copy == Deck(Moves, CopyText)
Pending == mv # "none" \/ fm # "none"

Bold(text) == IF text = "none" THEN "none" ELSE "bold"

HasMove(b) == b \in {"m", "m+", "mf"}
HasBold(b) == b \in {"f", "mf"}
LandedAt(b) == IF HasMove(b) THEN mvAt ELSE fmAt

\* sendBatches sends the pending rows in order, one batch per once: a batch is the first row and
\* the rows after it that carry its once, and rows with no once yet are sealed with a new one.
First ==
  IF mv = "row" THEN IF fm = "row" THEN "mf" ELSE "m"
  ELSE IF mv = "sealed" THEN IF together /\ fm = "sealed" THEN "mf" ELSE "m"
  ELSE IF fm # "none" THEN "f" ELSE ""

Seal ==
  /\ mv' = IF HasMove(First) THEN "sealed" ELSE mv
  /\ fm' = IF HasBold(First) THEN "sealed" ELSE fm
  /\ together' = (together \/ First = "mf")

TypeOK ==
  /\ made \in 0..2
  /\ mv \in {"none", "row", "sealed"}
  /\ mvc \in BOOLEAN
  /\ fm \in {"none", "row", "sealed"}
  /\ fmc \in BOOLEAN
  /\ together \in BOOLEAN
  /\ words \in Texts
  /\ floored \in BOOLEAN
  /\ older \in BOOLEAN
  /\ crev \in 0..2
  /\ rev \in 0..2
  /\ mvAt \in 0..2
  /\ fmAt \in 0..2
  /\ version \in 1..2
  /\ reloads \in 0..Reloads
  /\ stopped1 \in BOOLEAN
  /\ wire1 \in {"none", "sent", "applied"}
  /\ wire2 \in {"none", "sent", "applied"}
  /\ batch1 \in {"", "m", "mf", "f"}
  /\ batch2 \in {"", "m", "m+", "mf", "f"}
  /\ known1 \in -1..2
  /\ known2 \in -1..2
  /\ asked2 \in -1..2
  /\ build2 \in 1..2
  /\ shown1 \in Shown
  /\ shown2 \in Shown
  /\ wrote2 \in BOOLEAN

\* Both tabs opened the deck at revision 0 on the older build. The copy holds no rows yet.
Init ==
  /\ made = 0
  /\ mv = "none"
  /\ mvc = FALSE
  /\ fm = "none"
  /\ fmc = FALSE
  /\ together = FALSE
  /\ words = "file"
  /\ floored = FALSE
  /\ older = FALSE
  /\ crev = 0
  /\ rev = 0
  /\ mvAt = 0
  /\ fmAt = 0
  /\ version = 1
  /\ reloads = 0
  /\ stopped1 = FALSE
  /\ wire1 = "none"
  /\ batch1 = ""
  /\ known1 = 0
  /\ shown1 = "file"
  /\ build2 = 1
  /\ wire2 = "none"
  /\ batch2 = ""
  /\ known2 = 0
  /\ asked2 = -1
  /\ shown2 = "file"
  /\ wrote2 = FALSE

\* The older tab meets the newer build: it shows the newer-version notice instead of the deck
\* and writes nothing more.
Stop ==
  /\ stopped1' = TRUE
  /\ known1' = -1
  /\ shown1' = ""

\* The answer to a batch (confirmRows), in one transaction: its pending rows go, and the rows
\* become confirmed rows, numbered after the copy's last one, unless the copy already holds that
\* revision or a newer one. The tab's mirror moves on when the revision is the next and the tab
\* wrote every row of the batch itself, so it painted them (takeEdits).
Confirm(batch, known, own) ==
  LET at == LandedAt(batch) IN
  /\ mv' = IF HasMove(batch) THEN "none" ELSE mv
  /\ fm' = IF HasBold(batch) THEN "none" ELSE IF batch = "m+" THEN "sealed" ELSE fm
  /\ IF crev >= at
     THEN UNCHANGED <<mvc, fmc, crev>>
     ELSE /\ mvc' = (mvc \/ HasMove(batch))
          /\ fmc' = (fmc \/ HasBold(batch))
          /\ crev' = at
  /\ known' = IF own /\ known = at - 1 THEN at ELSE known
  /\ wrote2' = (wrote2 /\ ~HasBold(batch))
  /\ UNCHANGED <<made, together, words, floored>>

\* adoptRows writes the deck at revision r into the copy as its confirmed rows, in one
\* transaction, unless the copy holds a newer revision.
Adopt(r) ==
  IF r >= crev
  THEN /\ mvc' = MovedAt(r)
       /\ fmc' = BoldAt(r)
       /\ crev' = r
  ELSE UNCHANGED <<mvc, fmc, crev>>

\* The server decides a batch: a spent once answers where it landed, a new one lands now.
Apply(wire, batch) ==
  /\ wire = "sent"
  /\ wire' = "applied"
  /\ IF LandedAt(batch) > 0
     THEN UNCHANGED Server
     ELSE /\ rev' = rev + 1
          /\ mvAt' = IF HasMove(batch) THEN rev + 1 ELSE mvAt
          /\ fmAt' = IF HasBold(batch) THEN rev + 1 ELSE fmAt
  /\ UNCHANGED <<Rows, version, reloads, batch>>

Move ==
  /\ made = 0
  /\ ~stopped1
  /\ IF version = 2
     THEN Stop /\ UNCHANGED <<Rows, wire1, batch1>>
     ELSE /\ made' = 1
          /\ mv' = "row"
          /\ older' = (older \/ version = 2)
          /\ UNCHANGED <<mvc, fm, fmc, together, words, floored, crev, stopped1, wire1, batch1, known1>>
          /\ shown1' = Copy'
  /\ UNCHANGED <<Server, version, reloads, Two>>

\* The design panel plans the bold against the copy: the box's words there, or the file's words
\* the page passes as its floor when the copy does not hold the box yet. Only then does the bold
\* row carry the floor; otherwise its base is the moved box's version.
Format ==
  /\ made = 1
  /\ made' = 2
  /\ fm' = "row"
  /\ words' = Bold(CopyText)
  /\ floored' = ~Moves
  /\ wrote2' = TRUE
  /\ UNCHANGED <<mv, mvc, fmc, together, older, crev, build2, wire2, batch2, known2, asked2>>
  /\ shown2' = Copy'
  /\ UNCHANGED <<Server, version, reloads, One>>

\* One request is on its way at a time, from either tab. A flush sends every batch of the rows
\* pending when it starts, one after another: batch m+ is the move, sealed alone by an earlier
\* send, with the bold still to go.
SendOne ==
  /\ ~stopped1
  /\ wire1 = "none"
  /\ wire2 = "none"
  /\ First # ""
  /\ IF version = 2
     THEN Stop /\ UNCHANGED <<Rows, wire1, batch1>>
     ELSE /\ wire1' = "sent"
          /\ batch1' = First
          /\ Seal
          /\ older' = (older \/ version = 2)
          /\ UNCHANGED <<made, mvc, fmc, words, floored, crev, stopped1, known1, shown1>>
  /\ UNCHANGED <<Server, version, reloads, Two>>

SendTwo ==
  /\ wire1 = "none"
  /\ wire2 = "none"
  /\ known2 # -1
  /\ asked2 = -1
  /\ First # ""
  /\ wire2' = "sent"
  /\ batch2' = IF First = "m" /\ fm = "row" THEN "m+" ELSE First
  /\ Seal
  /\ UNCHANGED <<made, mvc, fmc, words, floored, older, crev, build2, known2, asked2, shown2, wrote2>>
  /\ UNCHANGED <<Server, version, reloads, One>>

ApplyOne == Apply(wire1, batch1) /\ UNCHANGED <<stopped1, known1, shown1, Two>>

ApplyTwo == Apply(wire2, batch2) /\ UNCHANGED <<build2, known2, asked2, shown2, wrote2, One>>

AnswerOne ==
  /\ wire1 = "applied"
  /\ wire1' = "none"
  /\ batch1' = ""
  /\ IF stopped1 \/ version = 2
     THEN Stop /\ UNCHANGED <<Rows, wrote2>>
     ELSE /\ Confirm(batch1, known1, batch1 = "m")
          /\ older' = (older \/ version = 2)
          /\ UNCHANGED <<stopped1, shown1>>
  /\ UNCHANGED <<Server, version, reloads, build2, wire2, batch2, known2, asked2, shown2>>

AnswerTwo ==
  /\ wire2 = "applied"
  /\ Confirm(batch2, known2, batch2 = "f" /\ wrote2)
  /\ IF batch2 = "m+"
     THEN /\ wire2' = "sent"
          /\ batch2' = "f"
     ELSE /\ wire2' = "none"
          /\ batch2' = ""
  /\ UNCHANGED <<older, build2, asked2, shown2, Server, version, reloads, One>>

\* follow: the server has a revision the tab's mirror does not; the tab reads the deck, writes
\* it into the copy as its confirmed rows, and paints the copy. It waits for the tab's own send,
\* and the model has no tab write confirmed rows while a request is on its way: it does not
\* track the row keys confirmRows numbers an answer's rows by.
FollowOne ==
  /\ ~stopped1
  /\ wire1 = "none"
  /\ wire2 = "none"
  /\ known1 < rev
  /\ IF version = 2
     THEN Stop /\ UNCHANGED <<Rows, wire1, batch1>>
     ELSE /\ Adopt(rev)
          /\ known1' = rev
          /\ older' = (older \/ version = 2)
          /\ UNCHANGED <<made, mv, fm, together, words, floored, stopped1, wire1, batch1>>
          /\ shown1' = Copy'
  /\ UNCHANGED <<Server, version, reloads, Two>>

FollowTwo ==
  /\ wire1 = "none"
  /\ wire2 = "none"
  /\ asked2 = -1
  /\ known2 # -1
  /\ known2 < rev
  /\ Adopt(rev)
  /\ known2' = rev
  /\ UNCHANGED <<made, mv, fm, together, words, floored, older, build2, wire2, batch2, asked2, wrote2>>
  /\ shown2' = Copy'
  /\ UNCHANGED <<Server, version, reloads, One>>

\* A reload drops the page's memory and paints the copy (deviceCopy) before the page asks the
\* server for the deck. A newer build opens the copy at its higher version.
ReloadTwo ==
  /\ reloads < Reloads
  /\ wire2 = "none"
  /\ reloads' = reloads + 1
  /\ build2' \in 1..2
  /\ version' = IF build2' = 2 THEN 2 ELSE version
  /\ known2' = -1
  /\ asked2' = -1
  /\ shown2' = Copy
  /\ wrote2' = FALSE
  /\ UNCHANGED <<Rows, Server, wire2, batch2, One>>

\* The opening page's open: the server answers with the deck as it is now, and the page keeps
\* the answer (openOnce) while it fetches the deck's parts.
ReadTwo ==
  /\ known2 = -1
  /\ asked2 = -1
  /\ asked2' = rev
  /\ UNCHANGED <<Rows, Server, version, reloads, build2, wire2, batch2, known2, shown2, wrote2, One>>

\* openDeck, or the first send, writes the kept answer into the copy as its confirmed rows
\* (adoptOpening and adopt) unless the copy holds a newer revision, and the page paints the
\* copy. Its mirror takes the answer's revision either way, so a newer one is followed.
AdoptTwo ==
  /\ asked2 # -1
  /\ wire1 = "none"
  /\ wire2 = "none"
  /\ Adopt(asked2)
  /\ known2' = asked2
  /\ asked2' = -1
  /\ UNCHANGED <<made, mv, fm, together, words, floored, older, build2, wire2, batch2, wrote2>>
  /\ shown2' = Copy'
  /\ UNCHANGED <<Server, version, reloads, One>>

Next ==
  \/ Move \/ Format
  \/ SendOne \/ ApplyOne \/ AnswerOne \/ FollowOne
  \/ SendTwo \/ ApplyTwo \/ AnswerTwo \/ FollowTwo
  \/ ReloadTwo \/ ReadTwo \/ AdoptTwo

Spec == Init /\ [][Next]_vars

\* Every edit a tab painted is pending in the copy or landed on the server. Harm if broken: a
\* tab overwrites the other tab's pending row, or drops it unsent.
NoEditLost ==
  /\ made >= 1 => (mv # "none" \/ mvAt > 0)
  /\ made = 2 => (fm # "none" \/ fmAt > 0)

\* The bold keeps the box's words. Harm if broken: the design panel plans against a box the copy
\* rebuilt with no words under it and writes the text back empty, PR 549.
WordsKept == words # "none"

\* Once a newer build opened the copy, the older tab writes nothing to it, so the copy holds no
\* row the newer build's upgrade did not see, and the older tab never sends a newer row.
OlderStaysOut == ~older

\* Once no row is pending, no answer is on its way and each tab's mirror holds the server's
\* revision, each tab that shows the deck paints the server's deck. Harm if broken: a tab shows
\* an old deck and its follow never paints it again. Main broke it until a tab moved its mirror
\* on only for rows it wrote: a tab that sent the other tab's pending row moved its mirror past a
\* revision it never painted, Move, SendTwo, ApplyTwo, AnswerTwo, FollowOne.
Quiet1 == stopped1 \/ (wire1 = "none" /\ known1 = rev)
Quiet2 == wire2 = "none" /\ asked2 = -1 /\ known2 = rev

SettledShowsServer ==
  (~Pending /\ Quiet1 /\ Quiet2) => /\ (stopped1 \/ shown1 = ServerDeck)
                                    /\ shown2 = ServerDeck

\* The copy never loses a confirmed row: no tab writes an older view of the deck over it. Harm if
\* broken: the other tab plans its next edit against a deck without a saved edit and writes over
\* it. Main broke it until the copy kept its revision: an opening page adopted the answer it kept
\* while the other tab's answer confirmed a newer revision, Move, SendOne, ReloadTwo, ReadTwo,
\* ApplyOne, AnswerOne, AdoptTwo.
NoOlderView == [][(mvc => mvc') /\ (fmc => fmc')]_vars
====
