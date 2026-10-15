import { NextRequest, NextResponse } from "next/server";
import { fetchWithResilience } from "@/lib/f1/http";
import { CircuitMapPayload, TrackPoint } from "@/lib/f1/schemas";

const OPENF1_BASE =
  process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1";

// Pemetaan nama sirkuit/negara OpenF1 ke ID GeoJSON resmi F1 (bacinger/f1-circuits)
const CIRCUIT_GEOJSON_MAP: Record<string, string> = {
  singapore: "sg-2008",
  "marina bay": "sg-2008",
  bahrain: "bh-2002",
  sakhir: "bh-2002",
  jeddah: "sa-2021",
  "saudi arabia": "sa-2021",
  melbourne: "au-1953",
  australia: "au-1953",
  suzuka: "jp-1962",
  japan: "jp-1962",
  shanghai: "cn-2004",
  china: "cn-2004",
  miami: "us-2022",
  imola: "it-1953",
  monaco: "mc-1929",
  "monte carlo": "mc-1929",
  montreal: "ca-1978",
  canada: "ca-1978",
  barcelona: "es-1991",
  catalunya: "es-1991",
  spain: "es-1991",
  spielberg: "at-1969",
  "red bull ring": "at-1969",
  austria: "at-1969",
  silverstone: "gb-1948",
  "great britain": "gb-1948",
  hungaroring: "hu-1986",
  budapest: "hu-1986",
  hungary: "hu-1986",
  spa: "be-1925",
  "spa-francorchamps": "be-1925",
  belgium: "be-1925",
  zandvoort: "nl-1948",
  netherlands: "nl-1948",
  monza: "it-1922",
  italy: "it-1922",
  baku: "az-2016",
  azerbaijan: "az-2016",
  austin: "us-2012",
  cota: "us-2012",
  "united states": "us-2012",
  mexico: "mx-1962",
  "mexico city": "mx-1962",
  interlagos: "br-1940",
  "sao paulo": "br-1940",
  brazil: "br-1940",
  "las vegas": "us-2023",
  lusail: "qa-2004",
  losail: "qa-2004",
  qatar: "qa-2004",
  "yas marina": "ae-2009",
  "abu dhabi": "ae-2009",
};

function normalizePoints(
  raw: { x: number; y: number }[],
  invertY = true
): TrackPoint[] {
  if (raw.length === 0) return [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const p of raw) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rangeX = Math.max(1e-6, maxX - minX);
  const rangeY = Math.max(1e-6, maxY - minY);
  const scale = 820 / Math.max(rangeX, rangeY);

  const offsetX = (1000 - rangeX * scale) / 2;
  const offsetY = (1000 - rangeY * scale) / 2;

  return raw.map((p, idx) => {
    const ratio = idx / raw.length;
    const sector: 1 | 2 | 3 = ratio < 0.33 ? 1 : ratio < 0.66 ? 2 : 3;
    const scaledX = (p.x - minX) * scale + offsetX;
    const scaledY = (p.y - minY) * scale + offsetY;
    return {
      x: Math.round(scaledX),
      y: Math.round(invertY ? 1000 - scaledY : scaledY),
      sector,
    };
  });
}

async function fetchOfficialCircuitGeoJson(
  circuitName: string
): Promise<TrackPoint[] | null> {
  const key = circuitName.toLowerCase().trim();
  let geoId = CIRCUIT_GEOJSON_MAP[key];
  if (!geoId) {
    for (const [k, v] of Object.entries(CIRCUIT_GEOJSON_MAP)) {
      if (key.includes(k) || k.includes(key)) {
        geoId = v;
        break;
      }
    }
  }
  if (!geoId) return null;

  const url = `https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits/${geoId}.geojson`;
  const geo = await fetchWithResilience<any>(url, { ttlSeconds: 86400 });
  const coords: number[][] =
    geo?.features?.[0]?.geometry?.coordinates ||
    geo?.geometry?.coordinates ||
    [];

  if (!Array.isArray(coords) || coords.length < 20) return null;

  const rawPts = coords.map((c) => ({
    x: Number(c[0]),
    y: Number(c[1]),
  }));
  return normalizePoints(rawPts, true);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSessionKey =
    searchParams.get("session_key") || searchParams.get("sessionKey");
  const sessionKey =
    rawSessionKey && !isNaN(Number(rawSessionKey)) ? Number(rawSessionKey) : 0;
  const circuitName = searchParams.get("circuit") || "Singapore";

  // 1. Prioritas Utama: Ambil GeoJSON Sirkuit F1 Asli (100% Akurat & Cepat)
  try {
    const geoPoints = await fetchOfficialCircuitGeoJson(circuitName);
    if (geoPoints && geoPoints.length > 20) {
      return NextResponse.json({
        sessionKey,
        circuitName,
        source: "OPENF1_GPS",
        points: geoPoints,
      } satisfies CircuitMapPayload);
    }
  } catch {
    // Lanjut ke OpenF1 /location jika GeoJSON gagal
  }

  // 2. Fallback Kedua: Ambil jejak telemetry X/Y dari OpenF1 /location
  if (sessionKey) {
    try {
      const laps = await fetchWithResilience<any[]>(
        `${OPENF1_BASE}/laps?session_key=${sessionKey}&lap_number=4`,
        { ttlSeconds: 3600 }
      );
      const validLap = laps.find(
        (l) =>
          l.date_start &&
          l.lap_duration &&
          l.lap_duration > 55 &&
          l.lap_duration < 150
      );

      if (validLap) {
        const startMs = new Date(validLap.date_start).getTime();
        const startIso = new Date(startMs).toISOString();
        const endIso = new Date(
          startMs + validLap.lap_duration * 1000
        ).toISOString();

        const locUrl = `${OPENF1_BASE}/location?session_key=${sessionKey}&driver_number=${validLap.driver_number}&date>${startIso}&date<${endIso}`;
        const locations = await fetchWithResilience<any[]>(locUrl, {
          ttlSeconds: 86400,
        });

        const validCoords = locations.filter(
          (pt) =>
            typeof pt.x === "number" &&
            typeof pt.y === "number" &&
            (pt.x !== 0 || pt.y !== 0)
        );

        if (validCoords.length >= 40) {
          const step = Math.max(1, Math.floor(validCoords.length / 220));
          const sampled = validCoords
            .filter((_, idx) => idx % step === 0)
            .map((pt) => ({ x: pt.x, y: pt.y }));

          return NextResponse.json({
            sessionKey,
            circuitName,
            source: "OPENF1_GPS",
            points: normalizePoints(sampled, true),
          } satisfies CircuitMapPayload);
        }
      }
    } catch {
      // Fallback terakhir
    }
  }

  // 3. Fallback Terakhir: Default ke Marina Bay Street Circuit GeoJSON
  const fallbackGeo = await fetchOfficialCircuitGeoJson("singapore").catch(
    () => []
  );
  return NextResponse.json({
    sessionKey,
    circuitName,
    source: "OPENF1_GPS",
    points: fallbackGeo || [],
  } satisfies CircuitMapPayload);
}

