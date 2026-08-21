import type { GameProfile } from './types';

export interface Prefill {
  readonly rounds: number;
  readonly cut: number;
}

/**
 * Rounds and cut size suggested for a field of `players`, read from the profile's
 * table. Always overridable in the UI — this is a prefill, not a constraint.
 */
export function prefillFor(profile: GameProfile, players: number): Prefill {
  for (const row of profile.structure) {
    const withinLower = players >= row.min;
    const withinUpper = row.max === null || players <= row.max;
    if (withinLower && withinUpper) return { rounds: row.rounds, cut: row.cut };
  }

  // Below the smallest row the MTR gives no guidance: run enough rounds to
  // separate the field, and cut no more players than the event actually has.
  const safePlayers = Math.max(players, 2);
  const rounds = Math.max(1, Math.ceil(Math.log2(safePlayers)));
  const cut = Math.max(1, Math.min(4, safePlayers - 1));
  return { rounds, cut };
}
