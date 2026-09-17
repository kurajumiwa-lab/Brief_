# Readability rules — every screen reads in a glance

Adopted 2026-09-18. This is the standing contract for copy in the flow. It exists
because the product's honesty rule ("never fake a number, never claim what isn't
there") got implemented as "explain every absence in full sentences", which turned
a tool into a disclosure. Honesty belongs to the data layer; the UI layer's job is
to be read.

## The filter, in order

For any piece of text on a working surface:

1. **Can it be a colour, an icon, a number or a bar?** → do that, delete the text.
2. If not, can it fit in **six words**? → shorten it.
3. If not, does the user need it *now*, to act? → keep it, once, on one screen.
4. If not → it goes to **You → How Brief works**. Not into the flow.

Rule 3 and rule 4 are the whole compromise: the app must not hide how a figure was
produced, and it must not make you read an essay to use it. So the reasoning is
shipped **in one place, reachable**, and `room.jsx` fails if a sentence is deleted
from the flow without existing on that page.

## The state dot

State is a dot. The word beside it is optional and one word long.

| Dot | Token | Means | Only when |
|---|---|---|---|
| 🟢 live | `--state-live` #4C9A54 | money in, or work that happened | a settled / completed / closed row exists |
| 🟡 quiet | `--state-quiet` #E0A13C | a **true zero**, nothing pending | the count was read and is 0 |
| 🔵 moving | `--state-moving` #2B6CFF | in transit now | a dispatch, pickup or open quote row says so |
| 🟠 stale | `--state-stale` #D97757 | past its own refresh window, or a loss landed | a timestamp or a decline row proves it |
| ⚪ no read | `--state-empty` #B9AC97 | the read failed or the figure is unmeasurable | anything else — **the default** |

Two hard edges:

- **Grey is the default, never green.** A component with no data cannot render
  confidence. `StateDot` takes `state="unknown"` unless a caller proves otherwise.
- **These hues are graphics, not text colours.** Amber on cream is ~2.1:1, which is
  unreadable as body copy and fine as an 8px dot. Labels stay ink; the dot carries
  the mood. (A colour alone also fails a colour-blind reader, which is why the
  optional one-word label exists.)

`preview/src/ui/StateDot.tsx` is the only source of these mappings, and
`dotForMaintenance()` maps the server's `fresh/active/stale/dormant/unstarted` so
five surfaces cannot disagree about what STALE looks like.

## The kill list (applied, with the tests that hold it)

| Killed | Where it went |
|---|---|
| "A space is…", "A WAIRO dispatch is…", "Groups with a door:… this is not a poster…", "Circles, split by whether you are in one…" | the audit page, or nothing — the list itself is the explanation |
| Every inline "How this is derived" | one ⓘ on Home's stakes line → the audit page |
| "…not a warning", "not nothing is happening near you", "not as a footnote to forget" | deleted. The app was arguing with a critic the user hadn't met |
| Two-sentence empty states | icon + ≤6 words + **one** action (exactly one — the filter's "Clear the filters"/"See everything" are now the same button) |
| "Space file · 8" | `To do · 8`. Users have a space and a list, not a filing cabinet |
| The long board note, the method tagline, the licence paragraph, the view-count caveat, the cohort note | the audit page |
| `PulseSurface` on Activity | removed: Home's bar owns "what's moving" |
| `0 settled orders through Brief yet — this starts at your first settled order` | `0 settled`, a big figure where a figure is the content |
| `re-read` text link in a header | an icon button, `aria-label` preserved |

`room.jsx` test 11 enforces the pair: no sentence over 120 characters on the board,
no `How this is derived` control there, no "Brief does not / will not infer / not a
warning" constructions — **and** the audit page must contain the count rule, the
no-browse-log reason, the flow rules, the price-source gap, the forecast-not-
observation line, the cohort gap, the missed-capture rule, maker/checker, the
attribution gap and the refusals.

## Motion

- A state **change** animates over 400 ms (`--ease-emphasized`) so a shift is felt
  rather than read. `prefers-reduced-motion` drops the transition and keeps the
  colour.
- No new infinite loops. Every loop in the app is on the reduced-motion kill list.
- Loading is a skeleton, never the word "Loading…".

## Numbers

- Compact: `18 offers live · 0 waiting on you`, not a sentence about them.
- Money keeps `KES n,nnn` (`toLocaleString('en-KE')`), whole shillings, mono.
- A zero prints as `0`; an unmeasurable figure prints as `—`, and `KES —` is never
  produced (a dash is never dressed as an amount — `tablebankingsurface.jsx` pins it).

## What this must never become

Terse is not the same as silent. If a future change makes a number un-auditable —
deleting the derivation instead of moving it — that is a bug with the same severity
as fabricating the number, and test 11 is written to fail on it.
