import { NextRequest, NextResponse } from "next/server";
import { getSeasonStandings } from "@/lib/f1/jolpica-provider";
import { fetchWithResilience } from "@/lib/f1/http";

const OPENF1_BASE =
  process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1";

// Fallback Headshot Resmi F1 Media CDN
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
  BEA: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/2col/image.png",
  COL: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/2col/image.png",
  LAW: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/2col/image.png",
  BOT: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/V/VALBOT01_Valtteri_Bottas/valbot01.png.transform/2col/image.png",
  ZHO: "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GUAZHO01_Guanyu_Zhou/guazho01.png.transform/2col/image.png",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || searchParams.get("season");
    const requestedSeason =
      yearParam && !isNaN(parseInt(yearParam, 10))
        ? parseInt(yearParam, 10)
        : new Date().getFullYear();

    let data = await getSeasonStandings(requestedSeason);
    // Jika musim berjalan (misal 2026) belum mengembalikan daftar driver dari Jolpica, fallback ke musim terakhir yang tersedia
    if (data.drivers.length === 0 && requestedSeason >= 2025) {
      data = await getSeasonStandings(2024);
    }

    // Ambil foto headshot dari OpenF1 /drivers?session_key=latest
    const headshotByCode = new Map<string, string>();
    try {
      const openDrivers = await fetchWithResilience<any[]>(
        `${OPENF1_BASE}/drivers?session_key=latest`,
        { ttlSeconds: 3600 }
      );
      for (const d of openDrivers) {
        if (d.name_acronym && d.headshot_url) {
          headshotByCode.set(d.name_acronym.toUpperCase(), d.headshot_url);
        }
      }
    } catch {
      // Gunakan fallback map jika gagal
    }

    const enrichedDrivers = data.drivers.map((drv) => ({
      ...drv,
      headshotUrl:
        headshotByCode.get(drv.code.toUpperCase()) ||
        F1_HEADSHOT_FALLBACK[drv.code.toUpperCase()] ||
        null,
    }));

    const enrichedBattles = data.teammateBattles.map((b) => ({
      ...b,
      driverA: {
        ...b.driverA,
        headshotUrl:
          headshotByCode.get(b.driverA.code.toUpperCase()) ||
          F1_HEADSHOT_FALLBACK[b.driverA.code.toUpperCase()] ||
          null,
      },
      driverB: {
        ...b.driverB,
        headshotUrl:
          headshotByCode.get(b.driverB.code.toUpperCase()) ||
          F1_HEADSHOT_FALLBACK[b.driverB.code.toUpperCase()] ||
          null,
      },
    }));

    return NextResponse.json({
      ...data,
      drivers: enrichedDrivers,
      teammateBattles: enrichedBattles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Gagal memuat klasemen F1" },
      { status: 500 }
    );
  }
}

