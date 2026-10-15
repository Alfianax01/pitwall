import { z } from "zod";
import { fetchWithResilience } from "./http";
import {
  LapRecord,
  NormalizedDriver,
  OpenF1DriverSchema,
  OpenF1IntervalSchema,
  OpenF1LapSchema,
  OpenF1PitSchema,
  OpenF1PositionSchema,
  OpenF1RaceControlSchema,
  OpenF1SessionSchema,
  OpenF1StintSchema,
  OpenF1WeatherSchema,
  RaceControlItem,
  SessionWeather,
  StintBlock,
  TimingPayload,
  TimingTowerRow,
  TrackPeriodBand,
  TrackStatus,
  TyreCompound,
} from "./schemas";

const OPENF1_BASE =
  process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1";

const DEFAULT_TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  McLaren: "#FF8000",
  Ferrari: "#E80020",
  Mercedes: "#27F4D2",
  "Aston Martin": "#229971",
  Alpine: "#0093CC",
  Williams: "#64C4FF",
  RB: "#6692FF",
  "Racing Bulls": "#6692FF",
  "Kick Sauber": "#52E252",
  "Haas F1 Team": "#B6BABD",
  Audi: "#F50537",
};

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.OPENF1_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return { Authorization: `Bearer ${apiKey.trim()}` };
  }
  return {};
}

function normalizeCompound(raw?: string | null): TyreCompound {
  const up = (raw || "").toUpperCase();
  if (up.includes("SOFT")) return "SOFT";
  if (up.includes("MEDIUM")) return "MEDIUM";
  if (up.includes("HARD")) return "HARD";
  if (up.includes("INTER")) return "INTERMEDIATE";
  if (up.includes("WET")) return "WET";
  return "UNKNOWN";
}

function parseNumericGap(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const cleaned = val.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function deriveTrackStatus(messages: RaceControlItem[]): TrackStatus {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const text = m.message.toUpperCase();
    const flag = (m.flag || "").toUpperCase();

    if (flag === "RED" || text.includes("RED FLAG")) return "RED";
    if (
      text.includes("SAFETY CAR DEPLOYED") ||
      text.includes("SAFETY CAR IN THIS LAP")
    ) {
      if (text.includes("IN THIS LAP") || text.includes("ENDING")) return "GREEN";
      return "SC";
    }
    if (text.includes("VIRTUAL SAFETY CAR")) {
      if (text.includes("ENDING")) return "GREEN";
      return "VSC";
    }
    if (flag.includes("YELLOW") || text.includes("YELLOW")) return "YELLOW";
    if (flag === "GREEN" || flag === "CLEAR" || text.includes("TRACK CLEAR")) {
      return "GREEN";
    }
  }
  return "GREEN";
}

function extractScPeriods(
  messages: RaceControlItem[],
  totalLaps: number
): TrackPeriodBand[] {
  const bands: TrackPeriodBand[] = [];
  let activeType: "SC" | "VSC" | null = null;
  let startLap = 1;

  for (const m of messages) {
    const text = m.message.toUpperCase();
    const lap = m.lapNumber || 1;
    if (!activeType) {
      if (text.includes("VIRTUAL SAFETY CAR DEPLOYED")) {
        activeType = "VSC";
        startLap = lap;
      } else if (text.includes("SAFETY CAR DEPLOYED")) {
        activeType = "SC";
        startLap = lap;
      }
    } else if (
      text.includes("SAFETY CAR IN THIS LAP") ||
      text.includes("VIRTUAL SAFETY CAR ENDING") ||
      text.includes("TRACK CLEAR") ||
      (m.flag || "").toUpperCase() === "GREEN"
    ) {
      bands.push({
        startLap,
        endLap: Math.max(startLap, lap),
        type: activeType,
      });
      activeType = null;
    }
  }

  if (activeType) {
    bands.push({
      startLap,
      endLap: totalLaps,
      type: activeType,
    });
  }
  return bands;
}

export async function listOpenF1Sessions(year?: number) {
  const currentYear = new Date().getFullYear();
  const candidateYears = year
    ? [year, year - 1, 2024]
    : [currentYear, currentYear - 1, 2024];

  for (const yr of candidateYears) {
    try {
      const url = `${OPENF1_BASE}/sessions?year=${yr}`;
      const raw = await fetchWithResilience<unknown[]>(url, {
        ttlSeconds: 300,
        headers: getAuthHeaders(),
      });
      const parsed = z.array(OpenF1SessionSchema).safeParse(raw);
      if (parsed.success && parsed.data.length > 0) {
        return parsed.data.sort(
          (a, b) =>
            new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        );
      }
    } catch {
      // Lanjut ke tahun sebelumnya jika tahun ini belum tersedia di OpenF1
    }
  }
  return [];
}

export async function getSessionTimingData(params: {
  sessionKey?: number;
  year?: number;
  country?: string;
  targetLap?: number;
}): Promise<TimingPayload> {
  const now = Date.now();
  const hasApiKey = Boolean(process.env.OPENF1_API_KEY?.trim());
  let selectedSession: any = null;

  if (params.sessionKey) {
    try {
      const raw = await fetchWithResilience<unknown[]>(
        `${OPENF1_BASE}/sessions?session_key=${params.sessionKey}`,
        { ttlSeconds: 3600, headers: getAuthHeaders() }
      );
      const parsed = z.array(OpenF1SessionSchema).safeParse(raw);
      if (parsed.success && parsed.data.length > 0) {
        selectedSession = parsed.data[0];
      }
    } catch {
      // fallback to list sessions
    }
  }

  if (!selectedSession) {
    const sessions = await listOpenF1Sessions(params.year);
    if (sessions.length === 0) {
      throw new Error("Tidak ada data sesi yang ditemukan dari OpenF1.");
    }

    if (params.sessionKey) {
      const found = sessions.find((s) => s.session_key === params.sessionKey);
      if (found) selectedSession = found;
    } else if (params.country) {
      const countryLower = params.country.toLowerCase();
      const matching = sessions.filter(
        (s) =>
          s.country_name.toLowerCase().includes(countryLower) ||
          s.location.toLowerCase().includes(countryLower)
      );
      const raceSession =
        matching.find((s) => s.session_type === "Race") || matching[0];
      if (raceSession) selectedSession = raceSession;
    } else {
      const active = sessions.find((s) => {
        const start = new Date(s.date_start).getTime();
        const end = new Date(s.date_end).getTime() + 45 * 60 * 1000;
        return now >= start && now <= end;
      });
      if (active && hasApiKey) {
        selectedSession = active;
      } else {
        const latestCompletedRace = sessions.find(
          (s) =>
            s.session_type === "Race" &&
            new Date(s.date_start).getTime() <= now
        );
        selectedSession = latestCompletedRace || sessions[0];
      }
    }

    if (!selectedSession) {
      selectedSession = sessions[0];
    }
  }

  const startMs = new Date(selectedSession.date_start).getTime();
  const endMs = new Date(selectedSession.date_end).getTime() + 45 * 60 * 1000;
  const isCurrentlyRunning = now >= startMs && now <= endMs;

  const mode: "LIVE" | "REPLAY" =
    isCurrentlyRunning && hasApiKey && !params.targetLap ? "LIVE" : "REPLAY";

  let modeReason = `Replay sesi ${selectedSession.country_name} GP (${selectedSession.session_name})`;
  if (mode === "LIVE") {
    modeReason = "Live timing aktif (Interval pembaruan 4 detik)";
  } else if (isCurrentlyRunning && !hasApiKey) {
    modeReason =
      "Sesi sedang berlangsung. Menampilkan mode replay tanpa API key.";
  }

  const ttl = mode === "LIVE" ? 3 : 1800;
  const sk = selectedSession.session_key;
  const headers = getAuthHeaders();
  const isRaceOrSprint =
    selectedSession.session_type.toLowerCase().includes("race") ||
    selectedSession.session_type.toLowerCase().includes("sprint");

  const [
    driversRaw,
    lapsRaw,
    stintsRaw,
    pitsRaw,
    rcRaw,
    weatherRaw,
    intervalsRaw,
    positionsRaw,
  ] = await Promise.allSettled([
    fetchWithResilience<unknown[]>(`${OPENF1_BASE}/drivers?session_key=${sk}`, {
      ttlSeconds: 1800,
      headers,
    }),
    fetchWithResilience<unknown[]>(`${OPENF1_BASE}/laps?session_key=${sk}`, {
      ttlSeconds: ttl,
      headers,
    }),
    fetchWithResilience<unknown[]>(`${OPENF1_BASE}/stints?session_key=${sk}`, {
      ttlSeconds: ttl,
      headers,
    }),
    fetchWithResilience<unknown[]>(`${OPENF1_BASE}/pit?session_key=${sk}`, {
      ttlSeconds: ttl,
      headers,
    }),
    fetchWithResilience<unknown[]>(
      `${OPENF1_BASE}/race_control?session_key=${sk}`,
      {
        ttlSeconds: ttl,
        headers,
      }
    ),
    fetchWithResilience<unknown[]>(`${OPENF1_BASE}/weather?session_key=${sk}`, {
      ttlSeconds: ttl,
      headers,
    }),
    fetchWithResilience<unknown[]>(
      `${OPENF1_BASE}/intervals?session_key=${sk}`,
      {
        ttlSeconds: ttl,
        headers,
      }
    ),
    fetchWithResilience<unknown[]>(
      `${OPENF1_BASE}/position?session_key=${sk}`,
      {
        ttlSeconds: ttl,
        headers,
      }
    ),
  ]);

  const rawDrivers =
    driversRaw.status === "fulfilled"
      ? z.array(OpenF1DriverSchema).safeParse(driversRaw.value).data ?? []
      : [];
  const rawLaps =
    lapsRaw.status === "fulfilled"
      ? z.array(OpenF1LapSchema).safeParse(lapsRaw.value).data ?? []
      : [];
  const rawStints =
    stintsRaw.status === "fulfilled"
      ? z.array(OpenF1StintSchema).safeParse(stintsRaw.value).data ?? []
      : [];
  const rawPits =
    pitsRaw.status === "fulfilled"
      ? z.array(OpenF1PitSchema).safeParse(pitsRaw.value).data ?? []
      : [];
  const rawRc =
    rcRaw.status === "fulfilled"
      ? z.array(OpenF1RaceControlSchema).safeParse(rcRaw.value).data ?? []
      : [];
  const rawWeather =
    weatherRaw.status === "fulfilled"
      ? z.array(OpenF1WeatherSchema).safeParse(weatherRaw.value).data ?? []
      : [];
  const rawIntervals =
    intervalsRaw.status === "fulfilled"
      ? z.array(OpenF1IntervalSchema).safeParse(intervalsRaw.value).data ?? []
      : [];
  const rawPositions =
    positionsRaw.status === "fulfilled"
      ? z.array(OpenF1PositionSchema).safeParse(positionsRaw.value).data ?? []
      : [];

  // 1. Deduplicate Drivers
  const driverMap = new Map<number, NormalizedDriver>();
  for (const d of rawDrivers) {
    if (!driverMap.has(d.driver_number)) {
      const teamName = d.team_name || "Formula 1 Team";
      const colorHex = d.team_colour
        ? `#${d.team_colour.replace("#", "")}`
        : DEFAULT_TEAM_COLORS[teamName] || "#E10600";
      driverMap.set(d.driver_number, {
        driverNumber: d.driver_number,
        code: d.name_acronym || String(d.driver_number),
        fullName:
          d.full_name || d.broadcast_name || `Driver #${d.driver_number}`,
        teamName,
        teamColor: colorHex,
      });
    }
  }

  let maxSessionLap = 1;
  for (const l of rawLaps) {
    if (l.lap_number > maxSessionLap) maxSessionLap = l.lap_number;
  }

  const activeLap = params.targetLap
    ? Math.min(Math.max(1, params.targetLap), maxSessionLap)
    : maxSessionLap;

  // 2. Stints per Driver
  const stintsByDriver = new Map<number, StintBlock[]>();
  for (const s of rawStints) {
    const list = stintsByDriver.get(s.driver_number) || [];
    list.push({
      stintNumber: s.stint_number,
      compound: normalizeCompound(s.compound),
      lapStart: s.lap_start ?? 1,
      lapEnd: s.lap_end ?? maxSessionLap,
      tyreAgeAtStart: s.tyre_age_at_start ?? 0,
    });
    stintsByDriver.set(s.driver_number, list);
  }
  for (const [dn, list] of stintsByDriver.entries()) {
    list.sort((a, b) => a.stintNumber - b.stintNumber);
    stintsByDriver.set(dn, list);
  }

  // 3. Pit Stops Lookup
  const pitLookup = new Map<string, number>();
  for (const p of rawPits) {
    pitLookup.set(
      `${p.driver_number}-${p.lap_number}`,
      p.pit_duration ?? 22.0
    );
  }

  // 4. Laps Matrix Calculation
  const lapsByDriver: Record<number, LapRecord[]> = {};
  for (const dn of driverMap.keys()) {
    lapsByDriver[dn] = [];
  }

  const rawLapsByDriver = new Map<number, Map<number, number | null>>();
  for (const l of rawLaps) {
    if (!rawLapsByDriver.has(l.driver_number)) {
      rawLapsByDriver.set(l.driver_number, new Map());
    }
    rawLapsByDriver
      .get(l.driver_number)!
      .set(l.lap_number, l.lap_duration ?? null);
  }

  const validDurations = rawLaps
    .map((l) => l.lap_duration)
    .filter((d): d is number => typeof d === "number" && d > 55 && d < 180);
  const baseLapTime =
    validDurations.length > 0
      ? validDurations.sort((a, b) => a - b)[
          Math.floor(validDurations.length * 0.25)
        ]
      : 88.5;

  const initialPosMap = new Map<number, number>();
  const latestPosMap = new Map<number, number>();
  for (const p of rawPositions) {
    if (!initialPosMap.has(p.driver_number)) {
      initialPosMap.set(p.driver_number, p.position);
    }
    latestPosMap.set(p.driver_number, p.position);
  }

  for (let lapNum = 1; lapNum <= maxSessionLap; lapNum++) {
    const lapStandings: {
      driverNumber: number;
      lapDuration: number | null;
      cumulativeTime: number;
      lapsCompleted: number;
    }[] = [];

    for (const dn of driverMap.keys()) {
      const driverLapMap = rawLapsByDriver.get(dn);
      const prevRecords = lapsByDriver[dn];
      const prevCum =
        prevRecords.length > 0
          ? prevRecords[prevRecords.length - 1].cumulativeTime ?? 0
          : (initialPosMap.get(dn) ?? 10) * 0.32;

      const hasLap = driverLapMap?.has(lapNum);
      const rawDur = driverLapMap?.get(lapNum) ?? null;

      if (hasLap || lapNum === 1) {
        const effectiveDur =
          rawDur !== null && rawDur > 0
            ? rawDur
            : baseLapTime + (initialPosMap.get(dn) ?? 10) * 0.22;
        const newCum = prevCum + effectiveDur;
        lapStandings.push({
          driverNumber: dn,
          lapDuration: rawDur,
          cumulativeTime: newCum,
          lapsCompleted: lapNum,
        });
      }
    }

    lapStandings.sort((a, b) => {
      if (b.lapsCompleted !== a.lapsCompleted) {
        return b.lapsCompleted - a.lapsCompleted;
      }
      return a.cumulativeTime - b.cumulativeTime;
    });

    const leaderCum = lapStandings[0]?.cumulativeTime ?? 0;

    lapStandings.forEach((entry, idx) => {
      const position = idx + 1;
      const gapToLeader =
        idx === 0 ? 0 : +(entry.cumulativeTime - leaderCum).toFixed(3);
      const intervalToAhead =
        idx === 0
          ? 0
          : +(
              entry.cumulativeTime - lapStandings[idx - 1].cumulativeTime
            ).toFixed(3);

      const driverStints = stintsByDriver.get(entry.driverNumber) || [];
      const matchingStint =
        driverStints.find(
          (s) => lapNum >= s.lapStart && lapNum <= s.lapEnd
        ) || driverStints[driverStints.length - 1];

      const compound: TyreCompound = matchingStint?.compound || "MEDIUM";
      const tyreAge = matchingStint
        ? Math.max(
            1,
            lapNum - matchingStint.lapStart + 1 + matchingStint.tyreAgeAtStart
          )
        : lapNum;

      const pitDur = pitLookup.get(`${entry.driverNumber}-${lapNum}`) ?? null;

      lapsByDriver[entry.driverNumber].push({
        driverNumber: entry.driverNumber,
        lapNumber: lapNum,
        lapDuration: entry.lapDuration,
        cumulativeTime: +entry.cumulativeTime.toFixed(3),
        gapToLeader,
        intervalToAhead,
        position,
        compound,
        tyreAge,
        isPitLap: pitDur !== null,
        pitDuration: pitDur,
      });
    });
  }

  // 5. Latest OpenF1 /intervals Snapshot
  const latestIntervalByDriver = new Map<
    number,
    { gap: string | number | null; interval: string | number | null }
  >();
  if (rawIntervals.length > 0) {
    for (const intv of rawIntervals) {
      latestIntervalByDriver.set(intv.driver_number, {
        gap: intv.gap_to_leader ?? null,
        interval: intv.interval ?? null,
      });
    }
  }

  // 6. Fastest Lap & Best Sectors Calculation
  let overallFastest: {
    driverNumber: number;
    code: string;
    lapTime: number;
    lapNumber: number;
  } | null = null;

  const personalBestByDriver = new Map<number, number>();
  let sessionBestS1 = Infinity;
  let sessionBestS2 = Infinity;
  let sessionBestS3 = Infinity;
  const driverBestSectors = new Map<
    number,
    { s1: number; s2: number; s3: number }
  >();

  for (const l of rawLaps) {
    if (l.lap_number > activeLap) continue;
    const dn = l.driver_number;
    const driver = driverMap.get(dn);

    if (l.lap_duration && l.lap_duration > 40) {
      const prevBest = personalBestByDriver.get(dn);
      if (prevBest === undefined || l.lap_duration < prevBest) {
        personalBestByDriver.set(dn, l.lap_duration);
      }
      if (!overallFastest || l.lap_duration < overallFastest.lapTime) {
        overallFastest = {
          driverNumber: dn,
          code: driver?.code || String(dn),
          lapTime: l.lap_duration,
          lapNumber: l.lap_number,
        };
      }
    }

    const curSec = driverBestSectors.get(dn) || {
      s1: Infinity,
      s2: Infinity,
      s3: Infinity,
    };
    if (l.duration_sector_1 && l.duration_sector_1 > 8) {
      if (l.duration_sector_1 < sessionBestS1)
        sessionBestS1 = l.duration_sector_1;
      if (l.duration_sector_1 < curSec.s1) curSec.s1 = l.duration_sector_1;
    }
    if (l.duration_sector_2 && l.duration_sector_2 > 8) {
      if (l.duration_sector_2 < sessionBestS2)
        sessionBestS2 = l.duration_sector_2;
      if (l.duration_sector_2 < curSec.s2) curSec.s2 = l.duration_sector_2;
    }
    if (l.duration_sector_3 && l.duration_sector_3 > 8) {
      if (l.duration_sector_3 < sessionBestS3)
        sessionBestS3 = l.duration_sector_3;
      if (l.duration_sector_3 < curSec.s3) curSec.s3 = l.duration_sector_3;
    }
    driverBestSectors.set(dn, curSec);
  }

  function evalSectorColor(
    val: number | null | undefined,
    pb: number,
    sb: number
  ): "PURPLE" | "GREEN" | "YELLOW" | "NONE" {
    if (!val || val <= 0) return "NONE";
    if (Math.abs(val - sb) < 0.005) return "PURPLE";
    if (Math.abs(val - pb) < 0.005) return "GREEN";
    return "YELLOW";
  }

  // 7. Build Timing Tower Rows
  const tower: TimingTowerRow[] = [];

  for (const [dn, driver] of driverMap.entries()) {
    const records = (lapsByDriver[dn] || []).filter(
      (r) => r.lapNumber <= activeLap
    );
    const latestRec = records[records.length - 1];
    const prevRec =
      records.length > 1 ? records[records.length - 2] : latestRec;

    const currentPos =
      activeLap === maxSessionLap && latestPosMap.has(dn)
        ? latestPosMap.get(dn)!
        : latestRec?.position ?? 20;
    const prevPos = prevRec?.position ?? currentPos;
    const posChange = prevPos - currentPos;

    const bestLap = personalBestByDriver.get(dn) ?? null;
    const lastLap = latestRec?.lapDuration ?? null;

    const isOverallFastest =
      bestLap !== null &&
      overallFastest !== null &&
      overallFastest.driverNumber === dn &&
      Math.abs(bestLap - overallFastest.lapTime) < 0.001;

    const isPersonalBest =
      !isOverallFastest &&
      lastLap !== null &&
      bestLap !== null &&
      Math.abs(lastLap - bestLap) < 0.001;

    const pitStops = records.filter((r) => r.isPitLap).length;

    let gapSeconds = latestRec?.gapToLeader ?? 0;
    let intervalSeconds = latestRec?.intervalToAhead ?? 0;
    let gapDisplay =
      currentPos === 1
        ? "LEADER"
        : gapSeconds > 0
          ? `+${gapSeconds.toFixed(3)}s`
          : "-";
    let intervalDisplay =
      currentPos === 1
        ? "-"
        : intervalSeconds > 0
          ? `+${intervalSeconds.toFixed(3)}s`
          : "-";

    // Jika di lap terakhir Race/Sprint dan ada data /intervals asli dari OpenF1, prioritaskan
    const realIntv = latestIntervalByDriver.get(dn);
    if (realIntv && activeLap === maxSessionLap && isRaceOrSprint) {
      if (realIntv.gap !== null && currentPos !== 1) {
        const parsedGap = parseNumericGap(realIntv.gap);
        if (typeof realIntv.gap === "string" && realIntv.gap.includes("LAP")) {
          gapDisplay = realIntv.gap;
        } else if (parsedGap !== null) {
          gapSeconds = parsedGap;
          gapDisplay = `+${parsedGap.toFixed(3)}s`;
        }
      }
      if (realIntv.interval !== null && currentPos !== 1) {
        const parsedIntv = parseNumericGap(realIntv.interval);
        if (
          typeof realIntv.interval === "string" &&
          realIntv.interval.includes("LAP")
        ) {
          intervalDisplay = realIntv.interval;
        } else if (parsedIntv !== null) {
          intervalSeconds = parsedIntv;
          intervalDisplay = `+${parsedIntv.toFixed(3)}s`;
        }
      }
    }

    const rawLapObj =
      rawLaps
        .filter((l) => l.driver_number === dn && l.lap_number <= activeLap)
        .slice(-1)[0] || null;
    const pbSec = driverBestSectors.get(dn) || {
      s1: Infinity,
      s2: Infinity,
      s3: Infinity,
    };

    const s1Val = rawLapObj?.duration_sector_1 ?? null;
    const s2Val = rawLapObj?.duration_sector_2 ?? null;
    const s3Val = rawLapObj?.duration_sector_3 ?? null;

    tower.push({
      position: currentPos,
      previousPosition: prevPos,
      positionChange: posChange,
      driverNumber: dn,
      code: driver.code,
      fullName: driver.fullName,
      teamName: driver.teamName,
      teamColor: driver.teamColor,
      interval: intervalDisplay,
      intervalSeconds,
      gapToLeader: gapDisplay,
      gapSeconds,
      lastLap,
      bestLap,
      isOverallFastest,
      isPersonalBest,
      sectors: {
        s1: {
          time: s1Val,
          color: evalSectorColor(s1Val, pbSec.s1, sessionBestS1),
        },
        s2: {
          time: s2Val,
          color: evalSectorColor(s2Val, pbSec.s2, sessionBestS2),
        },
        s3: {
          time: s3Val,
          color: evalSectorColor(s3Val, pbSec.s3, sessionBestS3),
        },
      },
      inPit: Boolean(latestRec?.isPitLap),
      compound: latestRec?.compound ?? "MEDIUM",
      tyreAge: latestRec?.tyreAge ?? 1,
      pitStops,
      stints: stintsByDriver.get(dn) || [],
    });
  }

  // Sort berdasarkan Best Lap jika Qualifying/Practice, atau berdasarkan Position jika Race
  if (!isRaceOrSprint) {
    tower.sort((a, b) => {
      const ba = a.bestLap ?? 999999;
      const bb = b.bestLap ?? 999999;
      return ba - bb;
    });
    const leaderBest = tower[0]?.bestLap ?? null;
    tower.forEach((row, index) => {
      row.position = index + 1;
      if (index === 0 || !leaderBest || !row.bestLap) {
        row.gapToLeader = index === 0 ? "LEADER" : "NO TIME";
        row.interval = "-";
        row.gapSeconds = 0;
        row.intervalSeconds = 0;
      } else {
        const diffLeader = +(row.bestLap - leaderBest).toFixed(3);
        const prevBest = tower[index - 1].bestLap ?? leaderBest;
        const diffAhead = +(row.bestLap - prevBest).toFixed(3);
        row.gapSeconds = diffLeader;
        row.intervalSeconds = diffAhead;
        row.gapToLeader = `+${diffLeader.toFixed(3)}s`;
        row.interval = `+${diffAhead.toFixed(3)}s`;
      }
    });
  } else {
    tower.sort((a, b) => a.position - b.position);
    tower.forEach((row, index) => {
      row.position = index + 1;
      if (index === 0) {
        row.gapToLeader = "LEADER";
        row.interval = "-";
        row.gapSeconds = 0;
        row.intervalSeconds = 0;
      }
    });
  }

  const allRcMessages: RaceControlItem[] = rawRc.map((rc, idx) => ({
    id: `${rc.date}-${idx}`,
    timestamp: rc.date,
    lapNumber: rc.lap_number ?? null,
    flag: rc.flag ?? null,
    category: rc.category ?? null,
    message: rc.message,
  }));

  const filteredRc = allRcMessages.filter(
    (m) => m.lapNumber === null || m.lapNumber <= activeLap
  );

  const trackStatus = deriveTrackStatus(filteredRc);
  const scPeriods = extractScPeriods(allRcMessages, maxSessionLap);

  const lastWeather = rawWeather[rawWeather.length - 1];
  const weather: SessionWeather = {
    airTemp: lastWeather?.air_temperature ?? 24.5,
    trackTemp: lastWeather?.track_temperature ?? 38.2,
    humidity: lastWeather?.humidity ?? 52,
    rainfall: Boolean(lastWeather?.rainfall && lastWeather.rainfall > 0),
    windSpeed: lastWeather?.wind_speed ?? 2.4,
  };

  return {
    mode,
    modeReason,
    fetchedAt: new Date().toISOString(),
    session: {
      sessionKey: selectedSession.session_key,
      sessionName: selectedSession.session_name,
      sessionType: selectedSession.session_type,
      countryName: selectedSession.country_name,
      circuitName: selectedSession.circuit_short_name,
      location: selectedSession.location || selectedSession.country_name,
      year: selectedSession.year,
      dateStart: selectedSession.date_start,
      dateEnd: selectedSession.date_end,
      gmtOffset: selectedSession.gmt_offset,
    },
    currentLap: activeLap,
    totalLaps: maxSessionLap,
    trackStatus,
    weather,
    overallFastestLap: overallFastest,
    drivers: Array.from(driverMap.values()),
    tower,
    lapsByDriver,
    raceControl: filteredRc.slice(-30).reverse(),
    scPeriods,
  };
}
