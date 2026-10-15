import { NextRequest, NextResponse } from "next/server";
import { fetchWithResilience } from "@/lib/f1/http";

const JOLPICA_BASE =
  process.env.JOLPICA_BASE_URL || "https://api.jolpi.ca/ergast/f1";
const OPENF1_BASE =
  process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1";

// Pemetaan kode 3 huruf (misal dari halaman /live) ke driverId Ergast/Jolpica
const CODE_TO_DRIVER_ID: Record<string, string> = {
  ver: "max_verstappen",
  nor: "norris",
  lec: "leclerc",
  pia: "piastri",
  sai: "sainz",
  ham: "hamilton",
  rus: "russell",
  per: "perez",
  alo: "alonso",
  gas: "gasly",
  hul: "hulkenberg",
  tsu: "tsunoda",
  str: "stroll",
  oco: "ocon",
  alb: "albon",
  bea: "bearman",
  col: "colapinto",
  law: "lawson",
  bot: "bottas",
  zho: "zhou",
  mag: "kevin_magnussen",
  ric: "ricciardo",
  sar: "sargeant",
  dev: "de_vries",
  vet: "vettel",
  rai: "raikkonen",
  msc: "mick_schumacher",
  lat: "latifi",
  gio: "giovinazzi",
  maz: "mazepin",
  kub: "kubica",
  kvy: "kvyat",
  gro: "grosjean",
  ant: "antonelli",
  doo: "doohan",
  bor: "bortoleto",
  had: "hadjar",
};

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

const F1_HEADSHOT_FALLBACK: Record<string, string> = {
  VER: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/2col/image.png",
  NOR: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/2col/image.png",
  LEC: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/2col/image.png",
  PIA: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/2col/image.png",
  SAI: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/2col/image.png",
  HAM: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/2col/image.png",
  RUS: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/2col/image.png",
  PER: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/2col/image.png",
  ALO: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/2col/image.png",
  GAS: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/2col/image.png",
  HUL: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/2col/image.png",
  TSU: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/2col/image.png",
  STR: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/2col/image.png",
  OCO: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/2col/image.png",
  ALB: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/2col/image.png",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { driverId: string } }
) {
  try {
    const rawParam = params.driverId.toLowerCase();
    const resolvedId = CODE_TO_DRIVER_ID[rawParam] || rawParam;

    const [infoRes, firstResultsRes, openDriversRes] =
      await Promise.allSettled([
        fetchWithResilience<any>(`${JOLPICA_BASE}/drivers/${resolvedId}.json`, {
          ttlSeconds: 86400,
        }),
        fetchWithResilience<any>(
          `${JOLPICA_BASE}/drivers/${resolvedId}/results.json?limit=100&offset=0`,
          { ttlSeconds: 86400 }
        ),
        fetchWithResilience<any[]>(
          `${OPENF1_BASE}/drivers?session_key=latest`,
          { ttlSeconds: 3600 }
        ),
      ]);

    const driverObj =
      infoRes.status === "fulfilled"
        ? infoRes.value?.MRData?.DriverTable?.Drivers?.[0]
        : null;

    if (!driverObj) {
      return NextResponse.json(
        { error: "Profil pembalap tidak ditemukan" },
        { status: 404 }
      );
    }

    const code = (
      driverObj.code || driverObj.familyName.slice(0, 3)
    ).toUpperCase();

    // Cari Headshot & Team Colour dari OpenF1
    let headshotUrl = F1_HEADSHOT_FALLBACK[code] || null;
    let teamColor = "#E10600";
    if (openDriversRes.status === "fulfilled" && Array.isArray(openDriversRes.value)) {
      const match = openDriversRes.value.find(
        (d: any) => (d.name_acronym || "").toUpperCase() === code
      );
      if (match?.headshot_url) headshotUrl = match.headshot_url;
      if (match?.team_colour)
        teamColor = `#${String(match.team_colour).replace("#", "")}`;
    }

    // Paginasi seluruh race results (results.json?limit=100&offset=...)
    const allRaces: any[] = [];
    if (firstResultsRes.status === "fulfilled" && firstResultsRes.value?.MRData) {
      const total = Number(firstResultsRes.value.MRData.total || 0);
      const firstPage = firstResultsRes.value.MRData.RaceTable?.Races ?? [];
      allRaces.push(...firstPage);

      if (total > 100) {
        const pagePromises: Promise<any>[] = [];
        for (let offset = 100; offset < total; offset += 100) {
          pagePromises.push(
            fetchWithResilience<any>(
              `${JOLPICA_BASE}/drivers/${resolvedId}/results.json?limit=100&offset=${offset}`,
              { ttlSeconds: 86400 }
            ).catch(() => null)
          );
        }
        const pages = await Promise.all(pagePromises);
        for (const page of pages) {
          if (page?.MRData?.RaceTable?.Races) {
            allRaces.push(...page.MRData.RaceTable.Races);
          }
        }
      }
    }

    // Kumpulkan musim unik secara berurutan
    const seasonSet = new Set<string>();
    for (const r of allRaces) {
      if (r.season) seasonSet.add(String(r.season));
    }
    const sortedSeasons = Array.from(seasonSet).sort(
      (a, b) => Number(a) - Number(b)
    );

    // Ambil DriverStandings per musim untuk championship position & poin resmi (concurrency 4 to prevent 429s)
    const standingsResults = await mapConcurrent(sortedSeasons, 4, (s) =>
      fetchWithResilience<any>(
        `${JOLPICA_BASE}/${s}/drivers/${resolvedId}/driverStandings.json`,
        { ttlSeconds: 86400 }
      ).catch(() => null)
    );
    const standingsBySeason = new Map<string, any>();
    standingsResults.forEach((res, i) => {
      const st =
        res?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0];
      if (st) {
        standingsBySeason.set(sortedSeasons[i], st);
      }
    });

    let totalWins = 0;
    let totalPodiums = 0;
    let totalPoles = 0;
    let bestFinish = 99;
    let dnfs = 0;
    const podiumsBySeason = new Map<string, number>();
    const winsBySeason = new Map<string, number>();
    const racesBySeason = new Map<string, number>();
    const racePointsBySeason = new Map<string, number>();
    const constructorsBySeason = new Map<string, Set<string>>();

    for (const race of allRaces) {
      const res = race.Results?.[0];
      if (!res) continue;
      const pos = Number(res.position);
      const grid = Number(res.grid);
      const pts = Number(res.points || 0);
      const seasonStr = String(race.season);

      racesBySeason.set(seasonStr, (racesBySeason.get(seasonStr) || 0) + 1);
      racePointsBySeason.set(
        seasonStr,
        (racePointsBySeason.get(seasonStr) || 0) + pts
      );

      if (res.Constructor?.name) {
        if (!constructorsBySeason.has(seasonStr)) {
          constructorsBySeason.set(seasonStr, new Set());
        }
        constructorsBySeason.get(seasonStr)!.add(res.Constructor.name);
      }

      if (pos === 1) {
        totalWins++;
        winsBySeason.set(seasonStr, (winsBySeason.get(seasonStr) || 0) + 1);
      }
      if (pos >= 1 && pos <= 3) {
        totalPodiums++;
        podiumsBySeason.set(
          seasonStr,
          (podiumsBySeason.get(seasonStr) || 0) + 1
        );
      }
      if (pos > 0 && pos < bestFinish) bestFinish = pos;
      if (grid === 1) totalPoles++;

      const status = String(res.status || "");
      if (!status.includes("Finished") && !status.startsWith("+")) {
        dnfs++;
      }
    }

    const seasonHistory = sortedSeasons.map((yr) => {
      const st = standingsBySeason.get(yr);
      const constructorNamesFromRace = Array.from(
        constructorsBySeason.get(yr) || []
      ).join(" / ");
      const constructorsFromStanding: any[] = st?.Constructors || [];
      const constructorNamesFromStanding = constructorsFromStanding
        .map((c: any) => c.name)
        .join(" / ");
      const teamName =
        constructorNamesFromStanding ||
        constructorNamesFromRace ||
        "Formula 1 Team";

      const officialPosition = Number(st?.position || 0);
      const officialWins = Number(st?.wins ?? (winsBySeason.get(yr) || 0));
      const officialPoints = Number(
        st?.points ?? (racePointsBySeason.get(yr) || 0)
      );

      return {
        season: Number(yr),
        roundCount: racesBySeason.get(yr) || 0,
        position: officialPosition,
        points: officialPoints,
        wins: officialWins,
        podiums: podiumsBySeason.get(yr) || 0,
        teamName,
        isChampion: officialPosition === 1,
      };
    });

    const totalChampionships = seasonHistory.filter((s) => s.isChampion).length;
    const totalPoints = +seasonHistory
      .reduce((acc, s) => acc + s.points, 0)
      .toFixed(1);
    const totalEntries = allRaces.length;

    const firstRace = allRaces[0]
      ? `${allRaces[0].season} ${allRaces[0].raceName}`
      : "-";
    const firstWinRace = allRaces.find(
      (r) => Number(r.Results?.[0]?.position) === 1
    );
    const firstWin = firstWinRace
      ? `${firstWinRace.season} ${firstWinRace.raceName}`
      : "Belum pernah menang";

    // Susun Timeline Tim Karir (Team Stints)
    const teamTimeline: {
      teamName: string;
      startYear: number;
      endYear: number;
      seasonsCount: number;
      wins: number;
      points: number;
    }[] = [];

    for (const sh of seasonHistory) {
      const prev = teamTimeline[teamTimeline.length - 1];
      if (prev && prev.teamName === sh.teamName) {
        prev.endYear = sh.season;
        prev.seasonsCount += 1;
        prev.wins += sh.wins;
        prev.points = +(prev.points + sh.points).toFixed(1);
      } else {
        teamTimeline.push({
          teamName: sh.teamName,
          startYear: sh.season,
          endYear: sh.season,
          seasonsCount: 1,
          wins: sh.wins,
          points: sh.points,
        });
      }
    }

    // 10 Balapan Terakhir
    const recentResults = allRaces
      .slice(-10)
      .reverse()
      .map((r) => {
        const res = r.Results?.[0];
        return {
          season: r.season,
          round: r.round,
          raceName: r.raceName,
          date: r.date,
          teamName: res?.Constructor?.name || "",
          grid: Number(res?.grid || 0),
          position: Number(res?.position || 0),
          points: Number(res?.points || 0),
          status: res?.status || "",
        };
      });

    return NextResponse.json({
      identity: {
        driverId: driverObj.driverId,
        code,
        permanentNumber: driverObj.permanentNumber || "-",
        givenName: driverObj.givenName,
        familyName: driverObj.familyName,
        fullName: `${driverObj.givenName} ${driverObj.familyName}`,
        dateOfBirth: driverObj.dateOfBirth,
        nationality: driverObj.nationality,
        wikiUrl: driverObj.url,
        headshotUrl,
        teamColor,
        currentTeam:
          seasonHistory[seasonHistory.length - 1]?.teamName || "Formula 1 Team",
      },
      careerStats: {
        entries: totalEntries,
        championships: totalChampionships,
        wins: totalWins,
        podiums: totalPodiums,
        poles: totalPoles,
        points: totalPoints,
        bestFinish: bestFinish === 99 ? 0 : bestFinish,
        dnfs,
        firstRace,
        firstWin,
        winRate:
          totalEntries > 0 ? +((totalWins / totalEntries) * 100).toFixed(1) : 0,
        podiumRate:
          totalEntries > 0
            ? +((totalPodiums / totalEntries) * 100).toFixed(1)
            : 0,
      },
      teamTimeline,
      seasonHistory,
      recentResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Gagal memuat profil pembalap" },
      { status: 500 }
    );
  }
}

