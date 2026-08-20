# can-i-draw

What does it take to make the cut? Enter a field size, a round count, a top cut, and a draw
rate; the page simulates the Swiss rounds thousands of times and reports the match-point totals
that made it.

Everything runs in the browser. There is no backend, no account, and nothing is sent anywhere.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # vitest, core only
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production bundle into dist/
```

## How it works

The field is represented as a count vector — `n[p]` is the number of players on `p` match
points — rather than as individual players. One round walks the point brackets from the top
down, carrying a pair-down player between brackets, and samples the number of drawn matches per
bracket from a binomial. Because no opponent history is tracked, no tiebreakers can be computed,
which is deliberate: the two numbers this site reports do not need them.

All randomness comes from an injected seeded RNG, so a seed reproduces a run exactly.

## What the two numbers mean

- **Guaranteed** — the lowest total that made the cut in *every* simulated tournament. This is an
  observed extremum, not a proof. It drifts upward as the run count rises.
- **Possible** — the lowest total that made the cut in *at least one* simulated tournament, with
  the share of runs in which that total was at or above the cut line.

The 99th percentile of the best total that missed and the 1st percentile of the worst total that
made it are shown alongside. Those are stable under resampling and are the numbers to plan
around.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`. This
repository is `spsalmon/mtg_tournament_calculator`, so GitHub Pages serves it from
`https://spsalmon.github.io/mtg_tournament_calculator/`, and `vite.config.ts` sets `base:
'/mtg_tournament_calculator/'` to match — if the repository is renamed, that string must change
with it or every asset 404s.

In the repository settings, Pages → Build and deployment → Source must be set to **GitHub
Actions**.

## Legal note

Intentional draws are legal in the Swiss rounds of most events but never in the
single-elimination top cut. Offering any incentive to induce a result is bribery and gets people
disqualified. See the [Magic Tournament Rules](https://blogs.magicjudges.org/rules/mtr/).
