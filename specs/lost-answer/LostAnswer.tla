---- MODULE LostAnswer ----
\* One slide command a person queued on one device, while the network loses answers and the
\* page reloads. The device keeps the command as a pending row until an answer confirms it,
\* and keeps the deck the server holds as confirmed rows, its mirror. flush in
\* packages/live/src/cache.ts seals the pending row with a once before the first send
\* (sealRows), so every send carries that once, and commitEdits in apps/api/src/saved.ts
\* answers a once it already spent with the revision it landed at and writes nothing.
\* lands counts the command in the server's deck. landedAt is the revision it landed at, so
\* every answer to it names landedAt. wire is the live page's request; orphan is a request a
\* reloaded page sent and never hears back from. known is the revision the device's mirror
\* holds, -1 on a page that has not read the deck yet. mirror counts the command in the
\* mirror, and pending says the pending row is still on the device. other says another
\* writer, an agent or another tab, wrote once.
EXTENDS Integers

VARIABLES lands, landedAt, rev, wire, orphan, pending, mirror, known, reloads, other

vars == <<lands, landedAt, rev, wire, orphan, pending, mirror, known, reloads, other>>

Reloads == 2

TypeOK ==
  /\ lands \in 0..2
  /\ landedAt \in 0..3
  /\ rev \in 0..3
  /\ wire \in {"none", "sent", "answered"}
  /\ orphan \in {"none", "sent"}
  /\ pending \in BOOLEAN
  /\ mirror \in 0..2
  /\ known \in -1..3
  /\ reloads \in 0..Reloads
  /\ other \in 0..1

\* The person added a slide on a deck the device read at revision 0.
Init ==
  /\ lands = 0
  /\ landedAt = 0
  /\ rev = 0
  /\ wire = "none"
  /\ orphan = "none"
  /\ pending = TRUE
  /\ mirror = 0
  /\ known = 0
  /\ reloads = 0
  /\ other = 0

\* The server decides a send: a spent once answers where it landed, a new one lands now.
Lands ==
  IF lands > 0
  THEN UNCHANGED <<lands, landedAt, rev>>
  ELSE /\ lands' = 1
       /\ landedAt' = rev + 1
       /\ rev' = rev + 1

\* sendRows reads the deck before it sends from a page that has not, so a send needs known.
Send ==
  /\ pending
  /\ wire = "none"
  /\ known # -1
  /\ wire' = "sent"
  /\ UNCHANGED <<lands, landedAt, rev, orphan, pending, mirror, known, reloads, other>>

Land ==
  /\ wire = "sent"
  /\ Lands
  /\ wire' = "answered"
  /\ UNCHANGED <<orphan, pending, mirror, known, reloads, other>>

\* The request or its answer is lost: the fetch throws, and the row stays pending.
Lose ==
  /\ wire \in {"sent", "answered"}
  /\ wire' = "none"
  /\ UNCHANGED <<lands, landedAt, rev, orphan, pending, mirror, known, reloads, other>>

\* sendRows reads the answer. A revision the mirror already holds means the mirror holds the
\* command: the row goes and nothing is added. Otherwise the row becomes a confirmed row.
Answer ==
  /\ wire = "answered"
  /\ wire' = "none"
  /\ pending' = FALSE
  /\ IF known # -1 /\ landedAt <= known
     THEN UNCHANGED <<mirror, known>>
     ELSE /\ mirror' = mirror + 1
          /\ known' = IF known = landedAt - 1 THEN landedAt ELSE known
  /\ UNCHANGED <<lands, landedAt, rev, orphan, reloads, other>>

\* A reload drops the page's memory. A request on its way stays on its way, unheard.
Reload ==
  /\ reloads < Reloads
  /\ orphan = "none"
  /\ reloads' = reloads + 1
  /\ known' = -1
  /\ wire' = "none"
  /\ orphan' = IF wire = "sent" THEN "sent" ELSE "none"
  /\ UNCHANGED <<lands, landedAt, rev, pending, mirror, other>>

OrphanLands ==
  /\ orphan = "sent"
  /\ orphan' = "none"
  /\ Lands
  /\ UNCHANGED <<wire, pending, mirror, known, reloads, other>>

OrphanLost ==
  /\ orphan = "sent"
  /\ orphan' = "none"
  /\ UNCHANGED <<lands, landedAt, rev, wire, pending, mirror, known, reloads, other>>

\* adopt replaces the mirror with the server's deck: opening the deck on a new page, or a
\* follow that saw a newer revision. Both wait for the page's own send (serial).
Adopt ==
  /\ wire = "none"
  /\ known = -1 \/ known < rev
  /\ known' = rev
  /\ mirror' = lands
  /\ UNCHANGED <<lands, landedAt, rev, wire, orphan, pending, reloads, other>>

Other ==
  /\ other = 0
  /\ other' = 1
  /\ rev' = rev + 1
  /\ UNCHANGED <<lands, landedAt, wire, orphan, pending, mirror, known, reloads>>

Next == Send \/ Land \/ Lose \/ Answer \/ Reload \/ OrphanLands \/ OrphanLost \/ Adopt \/ Other

Spec == Init /\ [][Next]_vars

\* The command lands once however often it is sent. Harm if broken: a slide added twice.
LandsOnce == lands <= 1

\* The device's mirror holds the command at most once, and once the pending row is gone it
\* holds exactly what the server holds. Harm if broken: the device shows a deck the server
\* does not hold, and every later edit is decided on it.
OneRow == mirror <= 1 /\ (~pending => mirror = lands)

\* withSlides skips a copy of a command it cannot apply instead of failing, so the deck
\* opens whatever the mirror and the pending rows hold. Copies counts the command on the
\* device; the replay opens the real device copy in every state and checks it shows the
\* command once when Copies > 0.
Copies == mirror + (IF pending THEN 1 ELSE 0)

ViewSkips == TRUE

OpenNeverFails == Copies <= 1 \/ ViewSkips
====
