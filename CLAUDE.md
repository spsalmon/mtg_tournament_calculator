# CLAUDE.md

Operational guide for this repository.

**`PLAN.md` is a backlog, not a spec.** Build what is in this file and stop. Do not implement the
verdict engine, the per-player advice matrix, tiebreakers, or the ID fixed-point cascade in v1.

---

## 1. What v1 is

**Working name:** `can-i-draw`

A single-page, static, client-side site on GitHub Pages. One screen, five inputs, one button,
two numbers out. Everything runs in the browser; there is no backend.

### Inputs

| Field | Type | Notes |
|---|---|---|
| Number of players | integer ≥ 2 | |
| Number of rounds | integer ≥ 1 | prefill from player count via the game profile, always overridable |
| Top cut size | 4 / 8 / 16 / 32 / custom | |
| Unintentional draw probability | percentage, 0–100, default ~2% | per match, any round — the "time was called" draw |
| ☐ Include intentional draws | checkbox | when ticked, simulated players ID whenever a draw locks them into the cut |

### Outputs

Two match-point totals, each with the record shorthand and a one-line explanation:

- **Guaranteed top cut** — the lowest total that made the cut in *every* simulated tournament.
- **Possible top cut** — the lowest total that made the cut in *at least one* simulated tournament.(include probability of making the cut)

Displayed next to them, not buried: the number of simulation runs, and the caveat in §2.3.

### Explicit non-goals for v1

No accounts, no backend, no analytics, no charts, no share links, no PWA, no tiebreaker modelling,
no skill/Elo model, no games beyond the MTG profile. The value of v1 is that two numbers are right.

---

## 2. What the two numbers mean

Points: win 3, draw 1, loss 0, bye 3. All state is integer match points. Never records.

### 2.1 Per-run measurement

Sort the finished field by points, descending. Then for that run:

```
worstIn(run)  = points of the player at rank C
bestOut(run)  = points of the player at rank C + 1
```

**No tiebreakers are needed anywhere in v1.** If the cut line falls inside a bracket — say twelve
players are on 12 points and only five cut slots remain — then rank `C` and rank `C+1` are both 12,
which correctly records that 12 points both made and missed the cut in that run. Ties resolve
themselves by construction. Do not add OMW%, GW%, or OGW%.

### 2.2 Aggregation across runs

```
possible   = min over runs of worstIn(run)
guaranteed = ( max over runs of bestOut(run) ) + one point increment
```

The increment is 1 when draws can occur (any integer total is reachable) and 3 when they cannot
(every total is a multiple of 3). Derive it from the configuration, do not hard-code 3.

The logic: if any run ever had a player on `S` points miss the cut, `S` is not guaranteed. So the
guaranteed threshold sits one reachable step above the highest total ever seen missing.

### 2.3 The caveat that must appear in the UI

These are ensemble extrema, not proofs. "Guaranteed" here means *never observed to fail in n runs*.
Extrema drift monotonically with sample size — more runs can only push `guaranteed` up and
`possible` down — so both numbers depend on the run count in a way a percentile would not.

Therefore:

- Always display the run count next to the results.
- Also compute and offer the robust companions: the 99th percentile of `bestOut` and the 1st
  percentile of `worstIn`. These are stable under resampling and are the numbers a user should
  actually plan around.
- Never print the word "guaranteed" without the qualifier attached.

---

## 3. The simulation

### 3.1 Simulate count vectors, not players

Represent the field as `n[p]` = number of players on `p` match points. Do **not** track individual
players — v1 needs no opponent history because it needs no tiebreakers. This keeps a run to roughly
`R × (3R+1)` bracket operations instead of `R × N`, so ten thousand runs are instant even for a
2000-player field.

One round, given `n[]`:

1. Walk brackets from highest points to lowest.
2. Carry any pair-down player from the bracket above into the current bracket's pool.
3. Pool size `b` gives `floor(b/2)` matches; if `b` is odd, one player pairs down to the next
   bracket. The pair-down match is between unequal point totals — handle both outcomes explicitly.
4. For each bracket, sample the number of drawn matches `d ~ Binomial(floor(b/2), pDraw)`. The
   remaining `m − d` matches are decisive, producing exactly `m − d` winners at `p+3` and `m − d`
   losers at `p`. Drawn matches move `2d` players to `p+1`.
5. If `N` is odd, one bye per round worth 3 points, assigned to the lowest bracket.

**Note what is and is not random.** The win/loss split inside a bracket is deterministic in
aggregate — half win, half lose. Run-to-run variance comes only from (a) how many matches draw,
(b) pair-down match outcomes, and (c) bye placement. A useful consequence: with `pDraw = 0`, no IDs,
and `N = 2^R`, every run is byte-identical. That is a required test (§5).

### 3.2 The intentional-draw rule

When the checkbox is ticked: **a pairing becomes an ID if both players would be locked into the cut
by taking the draw.** No thresholds, no tuning, no probability — a player either is or is not
mathematically safe.

**The check runs every round, over all remaining rounds.** A player who can draw out the rest of
the event starts drawing the moment that becomes true — a 3-0 with two rounds left draws both, which
is what players actually do.

Lock check with `k` rounds left for a player on `p` points who draws them all, finishing on
`p + k·draw`: count the maximum number of players who could possibly finish strictly above that. A
player on `q` needs to gain `g = p + k·draw + 1 − q`. Only the next round's pairings are known from
the standings; after it the field scatters and anyone may face anyone, so the later `k−1` rounds are
left unconstrained at a win each. Every bracket therefore reduces to what it must gain in the next
round alone, `need = g − (k−1)·win`:

- `need ≤ draw` → all `b`. Drawing the next round is enough (`need ≤ 0` included — points never
  decrease).
- `need ≤ win` → only the winners, bounded below.
- otherwise → nobody, bar a bye holder if a bye ever outruns a win.

Leaving the later rounds unconstrained is a deliberate over-count: real Swiss re-brackets the
winners and halves them again. Over-counting can only withhold a draw, never invent one.

**The winner bound is not `ceil(b/2)`.** Pair-downs and byes both beat that, and an under-count is
exactly how a lock gets invented. Both are deterministic in the count vector, so walk the brackets
top-down as `round.ts` does: a bracket of `b` receiving a pair-down `c` fields `ceil((b+c)/2)`
possible winners — its own matches, plus the seat facing the player paired down into it, plus the
seat it pairs down itself — and passes `(b+c) % 2` onward. The bye comes off the lowest occupied
bracket before any pairing and is a win nobody played for, so count its holder separately. A flat
`ceil(b/2)` fails the exhaustive test in §5 on 317 cases.

Sum over all brackets. If the total is `< C`, the player is locked.

At the count-vector level this is convenient: both players in a same-bracket pairing sit on
identical points, so an entire bracket either IDs or does not. Only pair-down pairings need the two
players checked separately.

### 3.3 Runs and reproducibility

Default 10,000 runs, with a control to raise it. All randomness flows through an **injected seeded
RNG** (mulberry32 is fine) so a given seed reproduces exactly. Assert this in a test. Run the
simulation in a Web Worker if it ever exceeds ~100 ms; at count-vector speed it probably will not.

### 3.4 Assumptions to state in the UI

Standard Swiss pairing within point brackets; no repeat-pairing avoidance (a consequence of not
tracking identities); no players dropping mid-event; no awarded byes beyond the odd-field bye; every
match 50/50 between equally-skilled players. A short assumptions line under the result is required,
not optional.

---

## 4. Architecture

```
/
├── index.html
├── vite.config.ts            # base: '/<repo-name>/' — the site 404s on Pages without this
├── src/
│   ├── core/                 # PURE. No DOM, no React. Publishable to npm as-is.
│   │   ├── types.ts
│   │   ├── structure.ts      # rounds & cut prefill from player count (data-driven)
│   │   ├── rng.ts            # seeded mulberry32 + binomial sampler
│   │   ├── round.ts          # one round: count vector -> count vector
│   │   ├── lock.ts           # final-round lock check driving the ID rule
│   │   ├── simulate.ts       # full run + ensemble aggregation
│   │   └── format.ts         # points <-> record shorthand ("13 pts = 4-1-1")
│   ├── ui/                   # one screen; a handful of components
│   ├── data/games/mtg.json
│   └── main.tsx
├── tests/
└── .github/workflows/{ci.yml,deploy.yml}
```

**Stack:** Vite + TypeScript (strict, `noUncheckedIndexedAccess`) + React + Tailwind + Vitest.
Mobile-first — the user is standing at a table holding a phone. Deploy via GitHub Actions using
`upload-pages-artifact` + `deploy-pages`, not the legacy branch method.

**The one architectural rule:** `src/core/` never imports React and never touches `window`. It takes
its RNG by injection so it is fully deterministic and testable from Node.

### Game profile — `src/data/games/mtg.json`

Do not hard-code these numbers in logic.

```jsonc
{
  "id": "mtg",
  "name": "Magic: The Gathering",
  "points": { "win": 3, "draw": 1, "loss": 0, "bye": 3 },
  "structure": [
    { "min": 9,   "max": 16,  "rounds": 5,  "cut": 4 },
    { "min": 17,  "max": 32,  "rounds": 5,  "cut": 8 },
    { "min": 33,  "max": 64,  "rounds": 6,  "cut": 8 },
    { "min": 65,  "max": 128, "rounds": 7,  "cut": 8 },
    { "min": 129, "max": 226, "rounds": 8,  "cut": 8 },
    { "min": 227, "max": 409, "rounds": 9,  "cut": 8 },
    { "min": 410, "max": null,"rounds": 10, "cut": 8 }
  ],
  "sourceUrl": "https://blogs.magicjudges.org/rules/mtr-appendix-e/",
  "sourceCheckedOn": "2026-08-20"
}
```

The 9–16 row has a Limited/Constructed split in the MTR (4 rounds + Top 8 when the playoff is a
draft, 5 rounds + Top 4 otherwise). Re-verify the table against the current MTR before launch; this
copy may already be stale.

---

## 5. Testing

`src/core/` gets unit tests on every exported function. Specifically required:

- **Golden case.** `N=32, R=5, C=8, pDraw=0`, no IDs. Every run must be identical, with final counts
  `{15:1, 12:5, 9:10, 6:10, 3:5, 0:1}`. Rank 8 and rank 9 both sit on 9 points, so `possible = 9`
  and `guaranteed = 12`. Both match the known reality of a 32-player five-rounder, where X-1 always
  cuts and X-2 is a scramble. If this test fails, the round transition is wrong.
- **Determinism.** With `pDraw = 0`, no IDs, and `N = 2^R`, variance across runs is exactly zero.
- **Seed reproducibility.** Same seed ⇒ identical output, asserted byte-for-byte.
- **Conservation.** The count vector sums to `N` after every round. Total points equal
  `3·(decisive) + 2·(drawn) + 3·(byes)`. Every player accumulates exactly `R` results.
- **Monotonicity.** `guaranteed ≥ possible` always. Raising the run count never lowers `guaranteed`
  and never raises `possible`.
- **Draws raise the bar.** Sweep configurations: increasing `pDraw` must never *lower* `guaranteed`.
  Draws destroy total points but distribute them more evenly, packing more players onto the bubble —
  two players on 11 who draw both reach 12, where a decisive match sends one to 14 and leaves the
  other on 11.
- **ID rule sanity.** With IDs on, the number of players finishing on the lock threshold must be
  greater than or equal to the IDs-off case for the same seed.
- **The lock bound is never beaten.** Exhaustively: for every bracket shape of a small field and
  every threshold, play out *every* legal continuation of the next one and two rounds and confirm
  the number of players finishing above the threshold never exceeds what `maxFinishingAbove`
  predicted. An under-count here is a player drawing into a cut they then miss.
- **Odd fields.** `N` odd produces exactly `R` byes.

---

## 6. Numerical hygiene — non-negotiable

A float-key bug already produced silently wrong results during design work on this project: a
probability distribution was leaking mass because sums that should have been equal landed on
different float values.

- **Never use a float as a map key.** Distributions are keyed by integer point totals.
- **Match points are integers.** No floating-point record arithmetic anywhere.
- **Any distribution asserts its mass sums to 1** within `1e-12`, in tests and in dev builds. This
  one check would have caught the bug immediately.

---

## 7. Tone

Two lines of copy are required somewhere visible, even in v1: intentional draws are legal in the
Swiss rounds of most events but **not** in the single-elimination top cut, and offering any
incentive — cards, money, a prize split — to induce a result is **bribery** and gets people
disqualified. Link the current MTR.

Beyond that: state assumptions, never imply precision the model lacks, and keep the §2.3 qualifier
attached to the word "guaranteed" everywhere it appears.

---

## 8. Definition of done for v1

Someone opens the site on a phone, enters 64 players / 6 rounds / Top 8 / 2% draw rate, ticks
"include intentional draws", presses the button, and gets two clearly-labelled point totals with
their record equivalents, the run count, the robust percentile companions, and a one-line
assumptions note. The golden case in §5 passes.