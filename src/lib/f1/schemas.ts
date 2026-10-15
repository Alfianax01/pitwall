import { z } from "zod";

// ==========================================
// 1. OPENF1 RAW API SCHEMAS (ZOD)
// ==========================================

export const OpenF1SessionSchema = z.object({
  session_key: z.number(),
  meeting_key: z.number(),
  session_name: z.string(),
  session_type: z.string(),
  date_start: z.string(),
  date_end: z.string(),
  year: z.number(),
  country_name: z.string(),
  country_code: z.string().nullable().optional(),
  circuit_short_name: z.string(),
  location: z.string().optional().default(""),
  gmt_offset: z.string().optional().default("00:00:00"),
});

export const OpenF1DriverSchema = z.object({
  driver_number: z.number(),
  broadcast_name: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  name_acronym: z.string().nullable().optional(),
  team_name: z.string().nullable().optional(),
  team_colour: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  session_key: z.number().optional(),
});

export const OpenF1LapSchema = z.object({
  session_key: z.number().optional(),
  driver_number: z.number(),
  lap_number: z.number(),
  lap_duration: z.number().nullable().optional(),
  duration_sector_1: z.number().nullable().optional(),
  duration_sector_2: z.number().nullable().optional(),
  duration_sector_3: z.number().nullable().optional(),
  is_pit_out_lap: z.boolean().nullable().optional(),
  date_start: z.string().nullable().optional(),
});

export const OpenF1IntervalSchema = z.object({
  session_key: z.number().optional(),
  driver_number: z.number(),
  date: z.string(),
  gap_to_leader: z.union([z.number(), z.string()]).nullable().optional(),
  interval: z.union([z.number(), z.string()]).nullable().optional(),
});

export const OpenF1PositionSchema = z.object({
  session_key: z.number().optional(),
  driver_number: z.number(),
  date: z.string(),
  position: z.number(),
});

export const OpenF1StintSchema = z.object({
  session_key: z.number().optional(),
  driver_number: z.number(),
  stint_number: z.number(),
  lap_start: z.number().nullable().optional(),
  lap_end: z.number().nullable().optional(),
  compound: z.string().nullable().optional(),
  tyre_age_at_start: z.number().nullable().optional(),
});

export const OpenF1PitSchema = z.object({
  session_key: z.number().optional(),
  driver_number: z.number(),
  lap_number: z.number(),
  pit_duration: z.number().nullable().optional(),
  date: z.string().optional(),
});

export const OpenF1RaceControlSchema = z.object({
  session_key: z.number().optional(),
  date: z.string(),
  lap_number: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  message: z.string(),
  scope: z.string().nullable().optional(),
  driver_number: z.number().nullable().optional(),
});

export const OpenF1WeatherSchema = z.object({
  session_key: z.number().optional(),
  date: z.string(),
  air_temperature: z.number().nullable().optional(),
  track_temperature: z.number().nullable().optional(),
  humidity: z.number().nullable().optional(),
  rainfall: z.number().nullable().optional(),
  wind_speed: z.number().nullable().optional(),
});

// ==========================================
// 2. JOLPICA (ERGAST) RAW API SCHEMAS (ZOD)
// ==========================================

export const JolpicaSessionTimeSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
});

export const JolpicaRaceSchema = z.object({
  season: z.string(),
  round: z.string(),
  url: z.string().optional(),
  raceName: z.string(),
  Circuit: z.object({
    circuitId: z.string(),
    circuitName: z.string(),
    url: z.string().optional(),
    Location: z.object({
      lat: z.string().optional(),
      long: z.string().optional(),
      locality: z.string(),
      country: z.string(),
    }),
  }),
  date: z.string(),
  time: z.string().optional(),
  FirstPractice: JolpicaSessionTimeSchema.optional(),
  SecondPractice: JolpicaSessionTimeSchema.optional(),
  ThirdPractice: JolpicaSessionTimeSchema.optional(),
  Sprint: JolpicaSessionTimeSchema.optional(),
  SprintQualifying: JolpicaSessionTimeSchema.optional(),
  SprintShootout: JolpicaSessionTimeSchema.optional(),
  Qualifying: JolpicaSessionTimeSchema.optional(),
  Results: z
    .array(
      z.object({
        number: z.string(),
        position: z.string(),
        points: z.string(),
        Driver: z.object({
          driverId: z.string(),
          code: z.string().optional(),
          givenName: z.string(),
          familyName: z.string(),
          nationality: z.string().optional(),
        }),
        Constructor: z.object({
          constructorId: z.string(),
          name: z.string(),
        }),
        grid: z.string().optional(),
        laps: z.string().optional(),
        status: z.string().optional(),
        Time: z
          .object({
            millis: z.string().optional(),
            time: z.string(),
          })
          .optional(),
      })
    )
    .optional(),
  QualifyingResults: z
    .array(
      z.object({
        number: z.string(),
        position: z.string(),
        Driver: z.object({
          driverId: z.string(),
          code: z.string().optional(),
          givenName: z.string(),
          familyName: z.string(),
        }),
        Constructor: z.object({
          constructorId: z.string(),
          name: z.string(),
        }),
      })
    )
    .optional(),
});

// ==========================================
// 3. NORMALIZED INTERNAL DOMAIN TYPES
// ==========================================

export type TyreCompound =
  | "SOFT"
  | "MEDIUM"
  | "HARD"
  | "INTERMEDIATE"
  | "WET"
  | "UNKNOWN";

export type TrackStatus = "GREEN" | "YELLOW" | "SC" | "VSC" | "RED";

export interface NormalizedDriver {
  driverNumber: number;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
}

export interface StintBlock {
  stintNumber: number;
  compound: TyreCompound;
  lapStart: number;
  lapEnd: number;
  tyreAgeAtStart: number;
}

export interface SectorStatus {
  s1: { time: number | null; color: "PURPLE" | "GREEN" | "YELLOW" | "NONE" };
  s2: { time: number | null; color: "PURPLE" | "GREEN" | "YELLOW" | "NONE" };
  s3: { time: number | null; color: "PURPLE" | "GREEN" | "YELLOW" | "NONE" };
}

export interface LapRecord {
  driverNumber: number;
  lapNumber: number;
  lapDuration: number | null;
  cumulativeTime: number | null;
  gapToLeader: number | null;
  intervalToAhead: number | null;
  position: number;
  compound: TyreCompound;
  tyreAge: number;
  isPitLap: boolean;
  pitDuration: number | null;
}

export interface TimingTowerRow {
  position: number;
  previousPosition: number;
  positionChange: number;
  driverNumber: number;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  interval: string;
  intervalSeconds: number;
  gapToLeader: string;
  gapSeconds: number;
  lastLap: number | null;
  bestLap: number | null;
  isOverallFastest: boolean;
  isPersonalBest: boolean;
  sectors: SectorStatus;
  inPit: boolean;
  compound: TyreCompound;
  tyreAge: number;
  pitStops: number;
  stints: StintBlock[];
}

export interface RaceControlItem {
  id: string;
  timestamp: string;
  lapNumber: number | null;
  flag: string | null;
  category: string | null;
  message: string;
}

export interface SessionWeather {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  rainfall: boolean;
  windSpeed: number;
}

export interface TrackPeriodBand {
  startLap: number;
  endLap: number;
  type: "SC" | "VSC";
}

export interface TimingPayload {
  mode: "LIVE" | "REPLAY";
  modeReason: string;
  fetchedAt: string;
  session: {
    sessionKey: number;
    sessionName: string;
    sessionType: string;
    countryName: string;
    circuitName: string;
    location: string;
    year: number;
    dateStart: string;
    dateEnd: string;
    gmtOffset: string;
  };
  currentLap: number;
  totalLaps: number;
  trackStatus: TrackStatus;
  weather: SessionWeather;
  overallFastestLap: {
    driverNumber: number;
    code: string;
    lapTime: number;
    lapNumber: number;
  } | null;
  drivers: NormalizedDriver[];
  tower: TimingTowerRow[];
  lapsByDriver: Record<number, LapRecord[]>;
  raceControl: RaceControlItem[];
  scPeriods: TrackPeriodBand[];
}

export interface TrackPoint {
  x: number;
  y: number;
  sector: 1 | 2 | 3;
}

export interface CircuitMapPayload {
  sessionKey: number;
  circuitName: string;
  source: "OPENF1_GPS" | "PROCEDURAL_CIRCUIT";
  points: TrackPoint[];
}

export interface DriverStandingItem {
  position: number;
  points: number;
  wins: number;
  driverId: string;
  code: string;
  fullName: string;
  nationality: string;
  teamName: string;
  teamColor: string;
  gapToLeader: number;
  pointsRatio: number;
  canWinTitle: boolean;
  headshotUrl?: string | null;
}

export interface ConstructorStandingItem {
  position: number;
  points: number;
  wins: number;
  constructorId: string;
  teamName: string;
  nationality: string;
  teamColor: string;
  gapToLeader: number;
  pointsRatio: number;
}

export interface TeammateBattleItem {
  constructorId: string;
  teamName: string;
  teamColor: string;
  driverA: {
    driverId?: string;
    code: string;
    fullName: string;
    points: number;
    qualiWins: number;
    raceWins: number;
    headshotUrl?: string | null;
  };
  driverB: {
    driverId?: string;
    code: string;
    fullName: string;
    points: number;
    qualiWins: number;
    raceWins: number;
    headshotUrl?: string | null;
  };
}

export interface StandingsPayload {
  season: number;
  round: number;
  remainingPointsMax: number;
  drivers: DriverStandingItem[];
  constructors: ConstructorStandingItem[];
  teammateBattles: TeammateBattleItem[];
}

export interface SessionScheduleItem {
  key: "FP1" | "FP2" | "FP3" | "SPRINT_QUALI" | "SPRINT" | "QUALI" | "RACE";
  label: string;
  utcIso: string;
}

export interface PodiumEntry {
  position: number;
  driverCode: string;
  driverName: string;
  constructorName: string;
  timeOrStatus: string;
}

export interface CalendarEvent {
  season: number;
  round: number;
  raceName: string;
  circuitId: string;
  circuitName: string;
  locality: string;
  country: string;
  countryFlag: string;
  circuitTimezoneOffset: string;
  raceUtcIso: string;
  sessions: SessionScheduleItem[];
  status: "COMPLETED" | "NEXT" | "UPCOMING";
  podium: PodiumEntry[];
  fullResults?: PodiumEntry[];
}
