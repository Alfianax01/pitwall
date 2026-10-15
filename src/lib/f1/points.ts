/**
 * Aturan Alokasi Poin FIA Formula 1 (2025-2026 Specification)
 * - Poin Race P1-P10: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1
 * - Poin Sprint P1-P8: 8, 7, 6, 5, 4, 3, 2, 1
 * - Tidak ada poin tambahan untuk Fastest Lap (dihapus oleh regulasi FIA mulai musim 2025/2026)
 */

export const RACE_POINTS_TABLE: readonly number[] = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1,
] as const;

export const SPRINT_POINTS_TABLE: readonly number[] = [
  8, 7, 6, 5, 4, 3, 2, 1,
] as const;

export const MAX_RACE_POINTS = 25;
export const MAX_SPRINT_POINTS = 8;
export const MAX_ROUND_POINTS_WITH_SPRINT = MAX_RACE_POINTS + MAX_SPRINT_POINTS; // 33
export const MAX_ROUND_POINTS_STANDARD = MAX_RACE_POINTS; // 25

/**
 * Mengembalikan poin balapan utama untuk posisi finis (1-indexed).
 * Posisi > 10 atau DNF mengembalikan 0.
 */
export function getRacePoints(position: number | null | undefined): number {
  if (!position || position < 1 || position > RACE_POINTS_TABLE.length) {
    return 0;
  }
  return RACE_POINTS_TABLE[position - 1] ?? 0;
}

/**
 * Mengembalikan poin sprint untuk posisi finis (1-indexed).
 * Posisi > 8 atau DNF mengembalikan 0.
 */
export function getSprintPoints(position: number | null | undefined): number {
  if (!position || position < 1 || position > SPRINT_POINTS_TABLE.length) {
    return 0;
  }
  return SPRINT_POINTS_TABLE[position - 1] ?? 0;
}

/**
 * Mengembalikan poin maksimum teoritis yang bisa diraih seorang pembalap pada 1 ronde GP.
 */
export function getMaxPointsForRound(hasSprint: boolean): number {
  return hasSprint ? MAX_ROUND_POINTS_WITH_SPRINT : MAX_ROUND_POINTS_STANDARD;
}

