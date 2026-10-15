import {
  getMaxPointsForRound,
  getRacePoints,
  getSprintPoints,
  MAX_RACE_POINTS,
  MAX_SPRINT_POINTS,
} from "./points";

export interface RemainingRaceEvent {
  season: number;
  round: number;
  raceName: string;
  circuitName: string;
  country: string;
  hasSprint: boolean;
  status?: "COMPLETED" | "NEXT" | "UPCOMING";
}

export interface DriverStandingInput {
  driverId: string;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  points: number;
  wins: number;
  position: number;
  recentFinishes?: (number | null)[]; // 1-20 or null for DNF, newest to oldest
  finishCountback?: Record<number, number>; // counts of P1, P2, P3...
}

export type WdcStatus = "CHAMPION" | "CONTENDER" | "ELIMINATED";

export interface DriverTitleChance {
  driverId: string;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  position: number;
  currentPoints: number;
  maxPointsPossible: number;
  deficitToLeader: number;
  status: WdcStatus;
  statusLabel: string;
}

export interface ClinchScenario {
  canClinchEarly: boolean;
  isAlreadyChampion: boolean;
  earliestRound: number | null;
  raceName: string | null;
  leadAtClinch: number | null;
  description: string;
}

export interface CustomFinishSelection {
  // round -> { race?: { [driverId]: number | "DNF" }, sprint?: { [driverId]: number | "DNF" } }
  [round: number]: {
    race?: Record<string, number | "DNF">;
    sprint?: Record<string, number | "DNF">;
  };
}

export interface ProjectedStandingItem {
  driverId: string;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  currentPoints: number;
  projectedPoints: number;
  currentPosition: number;
  projectedPosition: number;
  positionChange: number; // positive = gained, negative = lost
  wins: number;
  isProjectedChampion: boolean;
  clinchRound: number | null; // round where title is mathematically sealed
  cumulativePointsByRound: Record<number, number>; // round -> cumulative points
}

export interface MonteCarloHistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
  percentage: number;
}

export interface MonteCarloDriverResult {
  driverId: string;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  currentPoints: number;
  championshipWins: number;
  winProbability: number; // 0 - 100 percentage
  avgPoints: number;
  minPoints: number;
  maxPoints: number;
  histogram: MonteCarloHistogramBin[];
}

export interface MonteCarloResult {
  simulationsRun: number;
  drivers: MonteCarloDriverResult[];
  racesSimulated: number;
  dataSourceNotes: string;
}

// ─── 1. KALKULASI POIN MAKSIMUM SISA ─────────────────────────────────────────

/**
 * Menghitung total poin maksimum yang masih bisa diraih oleh seorang pembalap
 * dari daftar sisa balapan (termasuk Sprint jika ada).
 */
export function computeRemainingMaxPoints(
  remainingRaces: RemainingRaceEvent[]
): number {
  return remainingRaces.reduce((total, race) => {
    return total + getMaxPointsForRound(race.hasSprint);
  }, 0);
}

// ─── 2. TIE-BREAKING ALGORITMA FIA (COUNTBACK) ──────────────────────────────

/**
 * Membandingkan 2 pembalap jika poin sama berdasarkan jumlah P1, lalu P2, dst.
 * Mengembalikan > 0 jika A lebih unggul, < 0 jika B lebih unggul, 0 jika sama persis.
 */
export function compareTieBreak(
  driverA: { points: number; wins?: number; finishCountback?: Record<number, number> },
  driverB: { points: number; wins?: number; finishCountback?: Record<number, number> }
): number {
  if (driverA.points !== driverB.points) {
    return driverA.points - driverB.points;
  }

  // Cek P1 (Wins)
  const winsA = driverA.wins ?? driverA.finishCountback?.[1] ?? 0;
  const winsB = driverB.wins ?? driverB.finishCountback?.[1] ?? 0;
  if (winsA !== winsB) {
    return winsA - winsB;
  }

  // Cek P2 s/d P20 jika ada data countback
  const countA = driverA.finishCountback || {};
  const countB = driverB.finishCountback || {};
  for (let pos = 2; pos <= 20; pos++) {
    const cA = countA[pos] || 0;
    const cB = countB[pos] || 0;
    if (cA !== cB) {
      return cA - cB;
    }
  }

  return 0;
}

// ─── 3. STATUS "MASIH BISA JUARA?" ──────────────────────────────────────────

/**
 * Menghitung status matematis perebutan gelar juara dunia untuk seluruh pembalap.
 */
export function evaluateTitleChances(
  standings: DriverStandingInput[],
  remainingRaces: RemainingRaceEvent[]
): DriverTitleChance[] {
  if (standings.length === 0) return [];

  const maxPointsAvailable = computeRemainingMaxPoints(remainingRaces);
  const sorted = [...standings].sort((a, b) => compareTieBreak(b, a));
  const leader = sorted[0];

  // Cek apakah pesaing terdekat (P2) sudah tidak bisa menyusul leader
  const p2 = sorted[1];
  const isLeaderAlreadyChampion =
    remainingRaces.length === 0 ||
    (p2 && leader.points > p2.points + maxPointsAvailable);

  return sorted.map((driver, index) => {
    const position = index + 1;
    const maxPointsPossible = driver.points + maxPointsAvailable;
    const deficitToLeader = Math.max(0, leader.points - driver.points);

    let status: WdcStatus;
    let statusLabel: string;

    if (isLeaderAlreadyChampion) {
      if (driver.driverId === leader.driverId) {
        status = "CHAMPION";
        statusLabel = "Juara secara matematis";
      } else {
        status = "ELIMINATED";
        statusLabel = "Tersingkir dari perebutan gelar";
      }
    } else {
      // Masih ada race tersisa dan belum ada yang kunci
      if (maxPointsPossible < leader.points) {
        status = "ELIMINATED";
        statusLabel = "Tersingkir dari perebutan gelar";
      } else {
        status = "CONTENDER";
        statusLabel = "Masih berpeluang";
      }
    }

    return {
      driverId: driver.driverId,
      code: driver.code,
      fullName: driver.fullName,
      teamName: driver.teamName,
      teamColor: driver.teamColor,
      position,
      currentPoints: driver.points,
      maxPointsPossible,
      deficitToLeader,
      status,
      statusLabel,
    };
  });
}

// ─── 4. SKENARIO CLINCH PALING CEPAT (EARLIEST CLINCH) ──────────────────────

/**
 * Menghitung di ronde balap mana pemimpin klasemen bisa mengunci gelar juara paling cepat,
 * berapa selisih poin yang dibutuhkan, dan menghasilkan kalimat ringkas otomatis.
 */
export function calculateEarliestClinch(
  standings: DriverStandingInput[],
  remainingRaces: RemainingRaceEvent[]
): ClinchScenario {
  if (standings.length === 0) {
    return {
      canClinchEarly: false,
      isAlreadyChampion: false,
      earliestRound: null,
      raceName: null,
      leadAtClinch: null,
      description: "Data klasemen belum tersedia.",
    };
  }

  const sorted = [...standings].sort((a, b) => compareTieBreak(b, a));
  const leader = sorted[0];
  const contender = sorted[1];

  if (!contender || remainingRaces.length === 0) {
    return {
      canClinchEarly: false,
      isAlreadyChampion: true,
      earliestRound: null,
      raceName: null,
      leadAtClinch: null,
      description: `${leader.fullName} telah dinobatkan sebagai Juara Dunia Formula 1 ${remainingRaces[0]?.season ?? ""}. Musim balap telah selesai.`,
    };
  }

  const totalRemainingMax = computeRemainingMaxPoints(remainingRaces);

  // Jika sudah unggul lebih besar dari total sisa poin
  if (leader.points > contender.points + totalRemainingMax) {
    return {
      canClinchEarly: false,
      isAlreadyChampion: true,
      earliestRound: null,
      raceName: null,
      leadAtClinch: leader.points - contender.points,
      description: `${leader.fullName} sudah mengunci gelar Juara Dunia secara matematis dengan keunggulan ${leader.points - contender.points} poin.`,
    };
  }

  // Hitung putaran demi putaran jika Leader memenangkan seluruh poin maksimal
  // dan Contender gagal meraih poin (atau meraih minimal)
  let accumulatedLeaderPoints = leader.points;
  let remainingAfterRound = totalRemainingMax;

  for (let idx = 0; idx < remainingRaces.length; idx++) {
    const race = remainingRaces[idx];
    const roundMax = getMaxPointsForRound(race.hasSprint);

    accumulatedLeaderPoints += roundMax;
    remainingAfterRound -= roundMax;

    // Contender max points if they score 0 until round idx, then win everything after
    const contenderMaxPossible = contender.points + remainingAfterRound;

    if (accumulatedLeaderPoints > contenderMaxPossible) {
      const neededDelta = accumulatedLeaderPoints - contender.points;
      const clinchMargin = neededDelta - remainingAfterRound;
      const raceName = race.raceName;
      const roundNum = race.round;

      return {
        canClinchEarly: true,
        isAlreadyChampion: false,
        earliestRound: roundNum,
        raceName,
        leadAtClinch: clinchMargin,
        description: `${leader.fullName} bisa mengunci gelar juara paling cepat di Ronde ${roundNum} (${raceName}) jika berhasil memperlebar keunggulan menjadi lebih dari ${remainingAfterRound} poin atas ${contender.fullName}.`,
      };
    }
  }

  // Jika tidak bisa mengunci sebelum ronde terakhir
  const lastRace = remainingRaces[remainingRaces.length - 1];
  return {
    canClinchEarly: false,
    isAlreadyChampion: false,
    earliestRound: lastRace.round,
    raceName: lastRace.raceName,
    leadAtClinch: null,
    description: `Persaingan gelar juara dunia terbuka hingga seri pamungkas di Ronde ${lastRace.round} (${lastRace.raceName}). Selisih saat ini: ${leader.points - contender.points} poin antara ${leader.fullName} dan ${contender.fullName}.`,
  };
}

// ─── 5. SIMULATOR SKENARIO PROYEKSI (WHAT-IF) ───────────────────────────────

/**
 * Menghitung klasemen proyeksi berdasarkan pilihan posisi finis pengguna per race & sprint.
 */
export function projectStandings(
  standings: DriverStandingInput[],
  remainingRaces: RemainingRaceEvent[],
  customFinishes: CustomFinishSelection = {}
): ProjectedStandingItem[] {
  const sorted = [...standings].sort((a, b) => compareTieBreak(b, a));

  // Inisialisasi map akumulasi poin
  const driverState = new Map<
    string,
    {
      driver: DriverStandingInput;
      currentPoints: number;
      projectedPoints: number;
      wins: number;
      cumulativePointsByRound: Record<number, number>;
      finishCountback: Record<number, number>;
    }
  >();

  for (const d of sorted) {
    driverState.set(d.driverId, {
      driver: d,
      currentPoints: d.points,
      projectedPoints: d.points,
      wins: d.wins,
      cumulativePointsByRound: {},
      finishCountback: { ...(d.finishCountback || {}), 1: d.wins },
    });
  }

  // Simulasikan ronde demi ronde
  let currentCumRound = 0;
  for (const race of remainingRaces) {
    currentCumRound = race.round;
    const roundSelection = customFinishes[race.round] || {};

    // 1. Tambah poin Sprint jika ada
    if (race.hasSprint && roundSelection.sprint) {
      for (const [driverId, pos] of Object.entries(roundSelection.sprint)) {
        const state = driverState.get(driverId);
        if (state && typeof pos === "number") {
          const pts = getSprintPoints(pos);
          state.projectedPoints += pts;
        }
      }
    }

    // 2. Tambah poin Race
    if (roundSelection.race) {
      for (const [driverId, pos] of Object.entries(roundSelection.race)) {
        const state = driverState.get(driverId);
        if (state && typeof pos === "number") {
          const pts = getRacePoints(pos);
          state.projectedPoints += pts;
          if (pos === 1) state.wins += 1;
          state.finishCountback[pos] = (state.finishCountback[pos] || 0) + 1;
        }
      }
    }

    // Catat kumulatif poin di akhir ronde ini
    for (const state of driverState.values()) {
      state.cumulativePointsByRound[race.round] = state.projectedPoints;
    }
  }

  // Urutkan klasemen proyeksi akhir
  const projectedArray = Array.from(driverState.values()).sort((a, b) => {
    return compareTieBreak(
      { points: b.projectedPoints, wins: b.wins, finishCountback: b.finishCountback },
      { points: a.projectedPoints, wins: a.wins, finishCountback: a.finishCountback }
    );
  });

  const leaderProjected = projectedArray[0];

  return projectedArray.map((item, index) => {
    const projectedPosition = index + 1;
    const currentPosition = item.driver.position;
    const positionChange = currentPosition - projectedPosition; // + jika naik, - jika turun
    const isProjectedChampion = index === 0;

    return {
      driverId: item.driver.driverId,
      code: item.driver.code,
      fullName: item.driver.fullName,
      teamName: item.driver.teamName,
      teamColor: item.driver.teamColor,
      currentPoints: item.currentPoints,
      projectedPoints: item.projectedPoints,
      currentPosition,
      projectedPosition,
      positionChange,
      wins: item.wins,
      isProjectedChampion,
      clinchRound: isProjectedChampion ? currentCumRound : null,
      cumulativePointsByRound: item.cumulativePointsByRound,
    };
  });
}

// ─── 6. MONTE CARLO PROBABILITAS SIMULATOR (DETERMINISTIK VIA SEED) ──────────

/**
 * PRNG Mulberry32 untuk menghasilkan angka acak deterministik dari seed.
 */
export function createSeededRandom(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Menjalankan simulasi Monte Carlo sisa musim untuk menghitung peluang juara dunia.
 * Didesain tanpa dependensi DOM agar dapat dijalankan langsung di Web Worker atau Node.js.
 */
export function runMonteCarlo(
  standings: DriverStandingInput[],
  remainingRaces: RemainingRaceEvent[],
  options: {
    simulations?: number;
    seed?: number;
    onProgress?: (progressPct: number) => void;
  } = {}
): MonteCarloResult {
  const { simulations = 10000, seed = 1234567, onProgress } = options;

  if (standings.length === 0 || remainingRaces.length === 0) {
    return {
      simulationsRun: 0,
      drivers: standings.map((d) => ({
        driverId: d.driverId,
        code: d.code,
        fullName: d.fullName,
        teamName: d.teamName,
        teamColor: d.teamColor,
        currentPoints: d.points,
        championshipWins: d.position === 1 ? simulations : 0,
        winProbability: d.position === 1 ? 100 : 0,
        avgPoints: d.points,
        minPoints: d.points,
        maxPoints: d.points,
        histogram: [],
      })),
      racesSimulated: 0,
      dataSourceNotes: "Musim balap telah selesai atau data tidak tersedia.",
    };
  }

  const rng = createSeededRandom(seed);
  const eligibleChances = evaluateTitleChances(standings, remainingRaces);
  const eligibleDrivers = standings.filter(
    (d) => eligibleChances.find((c) => c.driverId === d.driverId)?.status !== "ELIMINATED"
  );

  // Jika hanya tersisa 1 contender (atau leader sudah kunci)
  if (eligibleDrivers.length <= 1) {
    const leader = standings[0];
    return {
      simulationsRun: simulations,
      drivers: standings.map((d) => ({
        driverId: d.driverId,
        code: d.code,
        fullName: d.fullName,
        teamName: d.teamName,
        teamColor: d.teamColor,
        currentPoints: d.points,
        championshipWins: d.driverId === leader.driverId ? simulations : 0,
        winProbability: d.driverId === leader.driverId ? 100.0 : 0.0,
        avgPoints: d.points,
        minPoints: d.points,
        maxPoints: d.points,
        histogram: [],
      })),
      racesSimulated: remainingRaces.length,
      dataSourceNotes: `${leader.fullName} telah mengunci gelar juara secara matematis.`,
    };
  }

  // Siapkan performa dasar dan rate DNF tiap pembalap berdasarkan bobot finish terakhir
  const driverPerformanceMap = new Map<
    string,
    { baseScore: number; dnfRate: number }
  >();

  for (const drv of standings) {
    const finishes = drv.recentFinishes || [];
    let weightedPosSum = 0;
    let weightTotal = 0;
    let dnfCount = 0;

    finishes.forEach((fin, idx) => {
      // Bobot eksponensial: balapan terbaru (idx = 0) memiliki bobot terbesar
      const w = Math.pow(0.85, idx);
      if (fin === null || fin > 20) {
        dnfCount++;
        weightedPosSum += 18 * w; // penalti DNF
      } else {
        weightedPosSum += fin * w;
      }
      weightTotal += w;
    });

    const avgPos = weightTotal > 0 ? weightedPosSum / weightTotal : drv.position;
    const dnfRate = finishes.length > 0 ? Math.min(0.2, dnfCount / finishes.length) : 0.05;

    // Skor performa balap: makin rendah avgPos, makin tinggi peluang finish di depan
    const baseScore = Math.max(1, 22 - avgPos);
    driverPerformanceMap.set(drv.driverId, { baseScore, dnfRate });
  }

  // Statistik akumulator simulasi
  const titleWinCounts = new Map<string, number>();
  const totalPointsAccum = new Map<string, number>();
  const minPointsMap = new Map<string, number>();
  const maxPointsMap = new Map<string, number>();
  const allFinalPoints = new Map<string, number[]>();

  for (const drv of standings) {
    titleWinCounts.set(drv.driverId, 0);
    totalPointsAccum.set(drv.driverId, 0);
    minPointsMap.set(drv.driverId, Infinity);
    maxPointsMap.set(drv.driverId, -Infinity);
    allFinalPoints.set(drv.driverId, []);
  }

  const batchSize = Math.max(500, Math.floor(simulations / 20));

  // Loop Monte Carlo N kali
  for (let sim = 1; sim <= simulations; sim++) {
    // Salin poin awal
    const simPoints = new Map<string, number>();
    const simWins = new Map<string, number>();
    for (const drv of standings) {
      simPoints.set(drv.driverId, drv.points);
      simWins.set(drv.driverId, drv.wins);
    }

    // Jalankan setiap sisa balapan
    for (const race of remainingRaces) {
      // Hitung skor acak setiap pembalap di balapan ini
      const raceCompetitors: { driverId: string; score: number }[] = [];

      for (const drv of standings) {
        const perf = driverPerformanceMap.get(drv.driverId)!;
        const isDnf = rng() < perf.dnfRate;
        if (isDnf) {
          raceCompetitors.push({ driverId: drv.driverId, score: -1 });
        } else {
          // Variasi normal/gumbel sederhana: baseScore + noise
          const noise = (rng() - 0.5) * 6;
          raceCompetitors.push({ driverId: drv.driverId, score: perf.baseScore + noise });
        }
      }

      // Urutkan finis berdasarkan score tertinggi
      raceCompetitors.sort((a, b) => b.score - a.score);

      // Berikan poin Race (P1-P10)
      raceCompetitors.forEach((entry, posIdx) => {
        if (entry.score > 0) {
          const pos = posIdx + 1;
          const pts = getRacePoints(pos);
          if (pts > 0) {
            simPoints.set(entry.driverId, (simPoints.get(entry.driverId) || 0) + pts);
            if (pos === 1) {
              simWins.set(entry.driverId, (simWins.get(entry.driverId) || 0) + 1);
            }
          }
        }
      });

      // Jika ada Sprint, simulasikan juga
      if (race.hasSprint) {
        const sprintCompetitors = raceCompetitors.map((c) => ({
          driverId: c.driverId,
          score: c.score > 0 ? c.score + (rng() - 0.5) * 4 : -1,
        }));
        sprintCompetitors.sort((a, b) => b.score - a.score);

        sprintCompetitors.forEach((entry, posIdx) => {
          if (entry.score > 0) {
            const pts = getSprintPoints(posIdx + 1);
            if (pts > 0) {
              simPoints.set(entry.driverId, (simPoints.get(entry.driverId) || 0) + pts);
            }
          }
        });
      }
    }

    // Tentukan juara musim untuk iterasi ini
    let champId = standings[0].driverId;
    let champPoints = -1;
    let champWins = -1;

    for (const drv of standings) {
      const p = simPoints.get(drv.driverId) || 0;
      const w = simWins.get(drv.driverId) || 0;

      // Akumulasi statistik
      totalPointsAccum.set(drv.driverId, (totalPointsAccum.get(drv.driverId) || 0) + p);
      if (p < minPointsMap.get(drv.driverId)!) minPointsMap.set(drv.driverId, p);
      if (p > maxPointsMap.get(drv.driverId)!) maxPointsMap.set(drv.driverId, p);
      allFinalPoints.get(drv.driverId)!.push(p);

      // Cek apakah lebih baik dari champ saat ini
      if (
        p > champPoints ||
        (p === champPoints && w > champWins)
      ) {
        champId = drv.driverId;
        champPoints = p;
        champWins = w;
      }
    }

    titleWinCounts.set(champId, (titleWinCounts.get(champId) || 0) + 1);

    if (onProgress && sim % batchSize === 0) {
      onProgress(Math.round((sim / simulations) * 100));
    }
  }

  // Susun hasil akhir per pembalap
  const results: MonteCarloDriverResult[] = standings.map((drv) => {
    const winsCount = titleWinCounts.get(drv.driverId) || 0;
    const winProbability = +((winsCount / simulations) * 100).toFixed(1);
    const avgPoints = Math.round(
      (totalPointsAccum.get(drv.driverId) || 0) / simulations
    );
    const minPoints = minPointsMap.get(drv.driverId) ?? drv.points;
    const maxPoints = maxPointsMap.get(drv.driverId) ?? drv.points;

    // Buat histogram 6 bin untuk sebaran poin
    const pointsList = allFinalPoints.get(drv.driverId) || [];
    const binCount = 6;
    const binSize = Math.max(1, Math.ceil((maxPoints - minPoints + 1) / binCount));
    const bins: MonteCarloHistogramBin[] = [];

    for (let b = 0; b < binCount; b++) {
      const binStart = minPoints + b * binSize;
      const binEnd = b === binCount - 1 ? maxPoints : binStart + binSize - 1;
      const inBin = pointsList.filter((pt) => pt >= binStart && pt <= binEnd).length;
      bins.push({
        binStart,
        binEnd,
        count: inBin,
        percentage: +((inBin / simulations) * 100).toFixed(1),
      });
    }

    return {
      driverId: drv.driverId,
      code: drv.code,
      fullName: drv.fullName,
      teamName: drv.teamName,
      teamColor: drv.teamColor,
      currentPoints: drv.points,
      championshipWins: winsCount,
      winProbability,
      avgPoints,
      minPoints,
      maxPoints,
      histogram: bins,
    };
  });

  results.sort((a, b) => {
    if (b.winProbability !== a.winProbability) {
      return b.winProbability - a.winProbability;
    }
    return b.avgPoints - a.avgPoints;
  });

  return {
    simulationsRun: simulations,
    drivers: results,
    racesSimulated: remainingRaces.length,
    dataSourceNotes: `Simulasi ${simulations.toLocaleString()} iterasi berdasarkan distribusi performa 5-8 race terakhir musim ${remainingRaces[0]?.season ?? ""} dan probabilitas DNF.`,
  };
}

