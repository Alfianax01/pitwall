import { z } from "zod";
import { fetchWithResilience } from "./http";
import {
  CalendarEvent,
  ConstructorStandingItem,
  DriverStandingItem,
  JolpicaRaceSchema,
  PodiumEntry,
  SessionScheduleItem,
  StandingsPayload,
  TeammateBattleItem,
} from "./schemas";

const JOLPICA_BASE =
  process.env.JOLPICA_BASE_URL || "https://api.jolpi.ca/ergast/f1";

const COUNTRY_FLAG_MAP: Record<string, { flag: string; offset: string }> = {
  Australia: { flag: "🇦🇺", offset: "+11:00" },
  Bahrain: { flag: "🇧🇭", offset: "+03:00" },
  "Saudi Arabia": { flag: "🇸🇦", offset: "+03:00" },
  Japan: { flag: "🇯🇵", offset: "+09:00" },
  China: { flag: "🇨🇳", offset: "+08:00" },
  USA: { flag: "🇺🇸", offset: "-05:00" },
  "United States": { flag: "🇺🇸", offset: "-05:00" },
  Italy: { flag: "🇮🇹", offset: "+02:00" },
  Monaco: { flag: "🇲🇨", offset: "+02:00" },
  Canada: { flag: "🇨🇦", offset: "-04:00" },
  Spain: { flag: "🇪🇸", offset: "+02:00" },
  Austria: { flag: "🇦🇹", offset: "+02:00" },
  UK: { flag: "🇬🇧", offset: "+01:00" },
  "Great Britain": { flag: "🇬🇧", offset: "+01:00" },
  Hungary: { flag: "🇭🇺", offset: "+02:00" },
  Belgium: { flag: "🇧🇪", offset: "+02:00" },
  Netherlands: { flag: "🇳🇱", offset: "+02:00" },
  Azerbaijan: { flag: "🇦🇿", offset: "+04:00" },
  Singapore: { flag: "🇸🇬", offset: "+08:00" },
  Mexico: { flag: "🇲🇽", offset: "-06:00" },
  Brazil: { flag: "🇧🇷", offset: "-03:00" },
  Qatar: { flag: "🇶🇦", offset: "+03:00" },
  UAE: { flag: "🇦🇪", offset: "+04:00" },
  "United Arab Emirates": { flag: "🇦🇪", offset: "+04:00" },
};

const TEAM_COLOR_LOOKUP: Record<string, string> = {
  red_bull: "#3671C6",
  mclaren: "#FF8000",
  ferrari: "#E80020",
  mercedes: "#27F4D2",
  aston_martin: "#229971",
  alpine: "#0093CC",
  williams: "#64C4FF",
  rb: "#6692FF",
  sauber: "#52E252",
  haas: "#B6BABD",
  audi: "#F50537",
  cadillac: "#D4AF37",
};

function resolveTeamColor(constructorId: string, name: string): string {
  const id = constructorId.toLowerCase();
  if (TEAM_COLOR_LOOKUP[id]) return TEAM_COLOR_LOOKUP[id];
  const n = name.toLowerCase();
  if (n.includes("red bull")) return "#3671C6";
  if (n.includes("mclaren")) return "#FF8000";
  if (n.includes("ferrari")) return "#E80020";
  if (n.includes("mercedes")) return "#27F4D2";
  if (n.includes("aston")) return "#229971";
  if (n.includes("williams")) return "#64C4FF";
  if (n.includes("alpine")) return "#0093CC";
  if (n.includes("haas")) return "#B6BABD";
  return "#71717A";
}

function toUtcIso(date: string, time?: string): string {
  const cleanTime = time
    ? time.endsWith("Z")
      ? time
      : `${time}Z`
    : "14:00:00Z";
  return `${date}T${cleanTime}`;
}

function isKnownSprintRace(race: {
  raceName: string;
  circuitId: string;
  country: string;
  hasExplicitSprint: boolean;
}): boolean {
  if (race.hasExplicitSprint) return true;
  const name = (race.raceName || "").toLowerCase();
  const cId = (race.circuitId || "").toLowerCase();
  const country = (race.country || "").toLowerCase();

  // Known official modern F1 Sprint venues (2024-2026):
  // 1. Shanghai (Chinese GP)
  // 2. Miami (Miami GP)
  // 3. Austin / COTA (United States GP)
  // 4. Interlagos / São Paulo (Brazilian GP)
  // 5. Lusail (Qatar GP)
  // 6. Spielberg / Red Bull Ring (Austrian GP)
  if (
    cId === "americas" ||
    name.includes("united states") ||
    (country === "usa" && name.includes("united states"))
  ) {
    return true;
  }
  if (
    cId === "interlagos" ||
    name.includes("são paulo") ||
    name.includes("sao paulo") ||
    name.includes("brazil")
  ) {
    return true;
  }
  if (
    cId === "losail" ||
    cId === "lusail" ||
    name.includes("qatar")
  ) {
    return true;
  }
  if (cId === "shanghai" || name.includes("chinese")) return true;
  if (cId === "miami" || name.includes("miami")) return true;
  if (cId === "red_bull_ring" || name.includes("austrian")) return true;

  return false;
}

export async function getSeasonCalendar(
  season: number
): Promise<CalendarEvent[]> {
  const scheduleUrl = `${JOLPICA_BASE}/${season}.json?limit=100`;
  const resultsUrl = `${JOLPICA_BASE}/${season}/results.json?limit=1000`;

  const [scheduleRaw, resultsRaw] = await Promise.allSettled([
    fetchWithResilience<any>(scheduleUrl, { ttlSeconds: 1800 }),
    fetchWithResilience<any>(resultsUrl, { ttlSeconds: 900 }),
  ]);

  const rawRaces: unknown[] =
    scheduleRaw.status === "fulfilled"
      ? scheduleRaw.value?.MRData?.RaceTable?.Races ?? []
      : [];

  const parsedRaces = z.array(JolpicaRaceSchema).safeParse(rawRaces);
  const races = parsedRaces.success ? parsedRaces.data : [];

  const resultsByRound = new Map<string, PodiumEntry[]>();
  if (resultsRaw.status === "fulfilled") {
    const resRaces: unknown[] =
      resultsRaw.value?.MRData?.RaceTable?.Races ?? [];
    const parsedRes = z.array(JolpicaRaceSchema).safeParse(resRaces);
    if (parsedRes.success) {
      for (const r of parsedRes.data) {
        if (r.Results && r.Results.length > 0) {
          resultsByRound.set(
            r.round,
            r.Results.map((item) => ({
              position: Number(item.position),
              driverCode:
                item.Driver.code ||
                item.Driver.familyName.slice(0, 3).toUpperCase(),
              driverName: `${item.Driver.givenName} ${item.Driver.familyName}`,
              constructorName: item.Constructor.name,
              timeOrStatus: item.Time?.time || item.status || "",
            }))
          );
        }
      }
    }
  }

  const now = Date.now();
  let nextAssigned = false;

  return races.map((race) => {
    const sessions: SessionScheduleItem[] = [];
    if (race.FirstPractice) {
      sessions.push({
        key: "FP1",
        label: "Free Practice 1",
        utcIso: toUtcIso(race.FirstPractice.date, race.FirstPractice.time),
      });
    }
    if (race.SecondPractice) {
      sessions.push({
        key: "FP2",
        label: "Free Practice 2",
        utcIso: toUtcIso(race.SecondPractice.date, race.SecondPractice.time),
      });
    }
    if (race.ThirdPractice) {
      sessions.push({
        key: "FP3",
        label: "Free Practice 3",
        utcIso: toUtcIso(race.ThirdPractice.date, race.ThirdPractice.time),
      });
    }
    const raceUtcIso = toUtcIso(race.date, race.time);

    const hasExplicitSprint = Boolean(
      race.Sprint || race.SprintQualifying || race.SprintShootout
    );
    const hasSprintSession = isKnownSprintRace({
      raceName: race.raceName,
      circuitId: race.Circuit.circuitId,
      country: race.Circuit.Location.country,
      hasExplicitSprint,
    });

    if (hasSprintSession && !sessions.some((s) => s.key === "SPRINT")) {
      const raceDate = new Date(raceUtcIso);
      const sprintDate = new Date(raceDate.getTime() - 24 * 3600 * 1000);
      const sprintQualiDate = new Date(raceDate.getTime() - 48 * 3600 * 1000);

      sessions.push({
        key: "SPRINT_QUALI",
        label: "Sprint Qualifying",
        utcIso: sprintQualiDate.toISOString(),
      });
      sessions.push({
        key: "SPRINT",
        label: "Sprint",
        utcIso: sprintDate.toISOString(),
      });
    }

    if (race.Qualifying) {
      sessions.push({
        key: "QUALI",
        label: "Qualifying",
        utcIso: toUtcIso(race.Qualifying.date, race.Qualifying.time),
      });
    }

    sessions.push({
      key: "RACE",
      label: "Grand Prix Race",
      utcIso: raceUtcIso,
    });

    sessions.sort(
      (a, b) => new Date(a.utcIso).getTime() - new Date(b.utcIso).getTime()
    );

    const raceEndTimestamp = new Date(raceUtcIso).getTime() + 3 * 3600 * 1000;
    const roundResults = resultsByRound.get(race.round) || [];

    let status: "COMPLETED" | "NEXT" | "UPCOMING" = "UPCOMING";
    if (roundResults.length > 0 || raceEndTimestamp < now) {
      status = "COMPLETED";
    } else if (!nextAssigned) {
      status = "NEXT";
      nextAssigned = true;
    }

    const countryMeta = COUNTRY_FLAG_MAP[race.Circuit.Location.country] || {
      flag: "🏁",
      offset: "+00:00",
    };

    return {
      season: Number(race.season),
      round: Number(race.round),
      raceName: race.raceName,
      circuitId: race.Circuit.circuitId,
      circuitName: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      countryFlag: countryMeta.flag,
      circuitTimezoneOffset: countryMeta.offset,
      raceUtcIso,
      sessions,
      status,
      podium: roundResults.slice(0, 3),
      fullResults: roundResults,
    };
  });
}

export async function getRoundDetail(
  season: number,
  round: number
): Promise<CalendarEvent | null> {
  const all = await getSeasonCalendar(season);
  return all.find((r) => r.round === round) || null;
}

export async function getSeasonStandings(
  season: number
): Promise<StandingsPayload> {
  const driverUrl = `${JOLPICA_BASE}/${season}/driverStandings.json`;
  const constructorUrl = `${JOLPICA_BASE}/${season}/constructorStandings.json`;
  const calendarUrl = `${JOLPICA_BASE}/${season}.json?limit=100`;
  const resultsUrl = `${JOLPICA_BASE}/${season}/results.json?limit=1000`;
  const qualiUrl = `${JOLPICA_BASE}/${season}/qualifying.json?limit=1000`;

  const [drvRes, conRes, calRes, raceRes, qualiRes] = await Promise.allSettled([
    fetchWithResilience<any>(driverUrl, { ttlSeconds: 900 }),
    fetchWithResilience<any>(constructorUrl, { ttlSeconds: 900 }),
    fetchWithResilience<any>(calendarUrl, { ttlSeconds: 1800 }),
    fetchWithResilience<any>(resultsUrl, { ttlSeconds: 900 }),
    fetchWithResilience<any>(qualiUrl, { ttlSeconds: 900 }),
  ]);

  const drvListObj =
    drvRes.status === "fulfilled"
      ? drvRes.value?.MRData?.StandingsTable?.StandingsLists?.[0]
      : null;

  const conListObj =
    conRes.status === "fulfilled"
      ? conRes.value?.MRData?.StandingsTable?.StandingsLists?.[0]
      : null;

  const totalRaces =
    calRes.status === "fulfilled"
      ? calRes.value?.MRData?.RaceTable?.Races?.length ?? 24
      : 24;

  const currentRound = Number(drvListObj?.round || conListObj?.round || 0);
  const remainingRaces = Math.max(0, totalRaces - currentRound);
  const remainingPointsMax =
    remainingRaces * 25 + Math.min(remainingRaces, 2) * 8;

  const rawDrivers: any[] = drvListObj?.DriverStandings ?? [];
  const leaderDriverPts = Number(rawDrivers[0]?.points ?? 0);

  const drivers: DriverStandingItem[] = rawDrivers.map((item, idx) => {
    const pts = Number(item.points ?? 0);
    const wins = Number(item.wins ?? 0);
    const constructor = item.Constructors?.[0] || {
      constructorId: "unknown",
      name: "F1 Team",
    };
    const gap = +(leaderDriverPts - pts).toFixed(1);

    return {
      position: Number(item.position || idx + 1),
      points: pts,
      wins,
      driverId: item.Driver?.driverId || `drv-${idx}`,
      code:
        item.Driver?.code ||
        (item.Driver?.familyName || "DRV").slice(0, 3).toUpperCase(),
      fullName: `${item.Driver?.givenName || ""} ${
        item.Driver?.familyName || ""
      }`.trim(),
      nationality: item.Driver?.nationality || "",
      teamName: constructor.name,
      teamColor: resolveTeamColor(constructor.constructorId, constructor.name),
      gapToLeader: gap,
      pointsRatio:
        leaderDriverPts > 0 ? Math.round((pts / leaderDriverPts) * 100) : 0,
      canWinTitle: gap <= remainingPointsMax,
    };
  });

  const rawConstructors: any[] = conListObj?.ConstructorStandings ?? [];
  const leaderConPts = Number(rawConstructors[0]?.points ?? 0);

  const constructors: ConstructorStandingItem[] = rawConstructors.map(
    (item, idx) => {
      const pts = Number(item.points ?? 0);
      const wins = Number(item.wins ?? 0);
      const cId = item.Constructor?.constructorId || `con-${idx}`;
      const cName = item.Constructor?.name || "Constructor";
      const gap = +(leaderConPts - pts).toFixed(1);

      return {
        position: Number(item.position || idx + 1),
        points: pts,
        wins,
        constructorId: cId,
        teamName: cName,
        nationality: item.Constructor?.nationality || "",
        teamColor: resolveTeamColor(cId, cName),
        gapToLeader: gap,
        pointsRatio:
          leaderConPts > 0 ? Math.round((pts / leaderConPts) * 100) : 0,
      };
    }
  );

  // Hitung Head-to-Head Rekan Setim (Qualifying & Race Finish)
  const raceRounds: any[] =
    raceRes.status === "fulfilled"
      ? raceRes.value?.MRData?.RaceTable?.Races ?? []
      : [];
  const qualiRounds: any[] =
    qualiRes.status === "fulfilled"
      ? qualiRes.value?.MRData?.RaceTable?.Races ?? []
      : [];

  // Kelompokkan 2 pembalap utama per tim
  const driversByTeam = new Map<string, DriverStandingItem[]>();
  for (const d of drivers) {
    const list = driversByTeam.get(d.teamName) || [];
    list.push(d);
    driversByTeam.set(d.teamName, list);
  }

  const teammateBattles: TeammateBattleItem[] = [];

  for (const [teamName, teamDrivers] of driversByTeam.entries()) {
    if (teamDrivers.length < 2) continue;
    const dA = teamDrivers[0];
    const dB = teamDrivers[1];

    let raceWinsA = 0;
    let raceWinsB = 0;
    for (const r of raceRounds) {
      const results: any[] = r.Results || [];
      const resA = results.find(
        (x) =>
          x.Driver?.driverId === dA.driverId || x.Driver?.code === dA.code
      );
      const resB = results.find(
        (x) =>
          x.Driver?.driverId === dB.driverId || x.Driver?.code === dB.code
      );
      if (resA && resB) {
        if (Number(resA.position) < Number(resB.position)) raceWinsA++;
        else if (Number(resB.position) < Number(resA.position)) raceWinsB++;
      }
    }

    let qualiWinsA = 0;
    let qualiWinsB = 0;
    for (const q of qualiRounds) {
      const qResults: any[] = q.QualifyingResults || [];
      const qA = qResults.find(
        (x) =>
          x.Driver?.driverId === dA.driverId || x.Driver?.code === dA.code
      );
      const qB = qResults.find(
        (x) =>
          x.Driver?.driverId === dB.driverId || x.Driver?.code === dB.code
      );
      if (qA && qB) {
        if (Number(qA.position) < Number(qB.position)) qualiWinsA++;
        else if (Number(qB.position) < Number(qA.position)) qualiWinsB++;
      }
    }

    // Jika endpoint qualifying belum lengkap untuk musim tersebut, estimasi proporsional dari race H2H
    if (qualiWinsA === 0 && qualiWinsB === 0 && (raceWinsA > 0 || raceWinsB > 0)) {
      qualiWinsA = raceWinsA;
      qualiWinsB = raceWinsB;
    }

    teammateBattles.push({
      constructorId: teamName.toLowerCase().replace(/\s+/g, "_"),
      teamName,
      teamColor: dA.teamColor,
      driverA: {
        driverId: dA.driverId,
        code: dA.code,
        fullName: dA.fullName,
        points: dA.points,
        qualiWins: qualiWinsA,
        raceWins: raceWinsA,
      },
      driverB: {
        driverId: dB.driverId,
        code: dB.code,
        fullName: dB.fullName,
        points: dB.points,
        qualiWins: qualiWinsB,
        raceWins: raceWinsB,
      },
    });
  }

  return {
    season,
    round: currentRound,
    remainingPointsMax,
    drivers,
    constructors,
    teammateBattles,
  };
}
