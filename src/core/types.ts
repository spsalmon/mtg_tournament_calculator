export interface PointValues {
  readonly win: number;
  readonly draw: number;
  readonly loss: number;
  readonly bye: number;
}

export interface StructureRow {
  readonly min: number;
  /** null means "and up" — the open-ended top row. */
  readonly max: number | null;
  readonly rounds: number;
  readonly cut: number;
}

export interface GameProfile {
  readonly id: string;
  readonly name: string;
  readonly points: PointValues;
  readonly structure: readonly StructureRow[];
  readonly sourceUrl: string;
  readonly sourceCheckedOn: string;
}

export interface SimConfig {
  readonly players: number;
  readonly rounds: number;
  readonly cut: number;
  /** Per-match probability that time is called and the match is drawn. 0..1. */
  readonly pDraw: number;
  readonly intentionalDraws: boolean;
  readonly runs: number;
  readonly seed: number;
  readonly points: PointValues;
}

export interface RunResult {
  /** Final count vector: counts[p] players finished on p match points. */
  readonly counts: Int32Array;
  /** Points of the player at rank `cut`. */
  readonly worstIn: number;
  /** Points of the player at rank `cut + 1`. */
  readonly bestOut: number;
  readonly decisive: number;
  readonly drawn: number;
  readonly byes: number;
}

export interface SimResult {
  readonly runs: number;
  /** Smallest reachable step between two point totals under this configuration. */
  readonly increment: number;
  /** Lowest total that made the cut in at least one run. */
  readonly possible: number;
  /** Fraction of runs in which `possible` points was at or above the cut line. */
  readonly possibleProbability: number;
  /** (Highest total ever seen missing the cut) + increment. Never observed to fail. */
  readonly guaranteed: number;
  /** 1st percentile of worstIn — the stable companion to `possible`. */
  readonly robustPossible: number;
  /** 99th percentile of bestOut + increment — the stable companion to `guaranteed`. */
  readonly robustGuaranteed: number;
  /** Raw max of bestOut across runs, before the increment is applied. */
  readonly maxBestOut: number;
}
