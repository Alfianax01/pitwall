import assert from "node:assert/strict";
import { formatLapTime, F1DataService } from "../src/lib/f1/index.ts";
import { generateIcsContent } from "../src/lib/f1/ics.ts";
import {
  OpenF1SessionSchema,
  OpenF1DriverSchema,
  OpenF1LapSchema,
  OpenF1IntervalSchema,
  OpenF1PositionSchema,
  OpenF1StintSchema,
  OpenF1WeatherSchema,
  OpenF1RaceControlSchema,
  JolpicaRaceSchema,
} from "../src/lib/f1/schemas.ts";
import {
  getRacePoints,
  getSprintPoints,
  getMaxPointsForRound,
} from "../src/lib/f1/points.ts";
import {
  computeRemainingMaxPoints,
  evaluateTitleChances,
  compareTieBreak,
  calculateEarliestClinch,
  projectStandings,
  runMonteCarlo,
} from "../src/lib/f1/simulate.ts";

async function runTests() {
  console.log("=== PITWALL INTEGRATION & UNIT TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. formatLapTime Edge Cases
  test("formatLapTime handles null / undefined / NaN / zero / negative", () => {
    assert.equal(formatLapTime(null), "-");
    assert.equal(formatLapTime(undefined), "-");
    assert.equal(formatLapTime(NaN), "-");
    assert.equal(formatLapTime(0), "-");
    assert.equal(formatLapTime(-12.4), "-");
  });

  test("formatLapTime formats sub-minute and multi-minute times correctly", () => {
    assert.equal(formatLapTime(58.213), "58.213s");
    assert.equal(formatLapTime(78.456), "1:18.456");
    assert.equal(formatLapTime(123.004), "2:03.004");
    assert.equal(formatLapTime(60.05), "1:00.050");
  });

  // 2. ICS Generator Tests
  test("generateIcsContent produces RFC-compliant VCALENDAR and VEVENT", () => {
    const mockEvent = {
      season: 2024,
      round: 1,
      raceName: "Bahrain Grand Prix",
      circuitId: "bahrain",
      circuitName: "Bahrain International Circuit",
      locality: "Sakhir",
      country: "Bahrain",
      countryFlag: "🇧🇭",
      circuitTimezoneOffset: "+03:00",
      raceUtcIso: "2024-03-02T15:00:00Z",
      sessions: [
        { key: "FP1", label: "Free Practice 1", utcIso: "2024-02-29T11:30:00Z" },
        { key: "RACE", label: "Grand Prix Race", utcIso: "2024-03-02T15:00:00Z" },
      ],
      status: "COMPLETED",
      podium: [],
    };

    const ics = generateIcsContent([mockEvent]);
    assert(ics.startsWith("BEGIN:VCALENDAR"), "Must start with BEGIN:VCALENDAR");
    assert(ics.endsWith("END:VCALENDAR"), "Must end with END:VCALENDAR");
    assert(ics.includes("SUMMARY:[F1] Bahrain Grand Prix - Free Practice 1"));
    assert(ics.includes("SUMMARY:[F1] Bahrain Grand Prix - Grand Prix Race"));
    assert(ics.includes("LOCATION:Bahrain International Circuit, Sakhir, Bahrain"));
    assert(ics.includes("UID:pitwall-2024-r1-FP1@pitwall.local"));
    assert(ics.includes("UID:pitwall-2024-r1-RACE@pitwall.local"));
    assert(ics.includes("\r\n"), "Must use CRLF line endings");
  });

  // 3. Schema Validations
  test("OpenF1 Driver Schema accepts optional/null fields", () => {
    const parsed = OpenF1DriverSchema.safeParse({
      driver_number: 1,
      broadcast_name: "M VERSTAPPEN",
      full_name: null,
      name_acronym: "VER",
      team_name: "Red Bull Racing",
      team_colour: "3671C6",
      country_code: "NED",
    });
    assert(parsed.success, "Should parse driver with null full_name");
  });

  test("OpenF1 Interval Schema accepts string and number intervals", () => {
    const withNum = OpenF1IntervalSchema.safeParse({
      driver_number: 11,
      date: "2024-03-02T15:30:00Z",
      gap_to_leader: 5.432,
      interval: 1.234,
    });
    assert(withNum.success);

    const withStr = OpenF1IntervalSchema.safeParse({
      driver_number: 44,
      date: "2024-03-02T15:30:00Z",
      gap_to_leader: "+1 LAP",
      interval: "+1 LAP",
    });
    assert(withStr.success);
  });

  // 4. Live API Test: Jolpica getSeasonCalendar
  await testAsync("F1DataService.getSeasonCalendar(2024) returns full 2024 calendar with podium results", async () => {
    const calendar = await F1DataService.getSeasonCalendar(2024);
    assert(Array.isArray(calendar), "Calendar must be an array");
    assert(calendar.length >= 20, `Calendar length ${calendar.length} should be at least 20 races`);
    const r1 = calendar.find((r) => r.round === 1);
    assert(r1, "Round 1 must exist");
    assert.equal(r1.season, 2024);
    assert(r1.sessions.length >= 4, "Must have FP1, FP2, FP3, Quali, Race");
    assert(r1.podium.length === 3, "Round 1 2024 was completed, must have 3 podium finishers");
    assert.equal(r1.podium[0].position, 1);
    assert(r1.status === "COMPLETED", "2024 Round 1 must be COMPLETED");
  });

  // 5. Live API Test: Jolpica getRoundDetail
  await testAsync("F1DataService.getRoundDetail(2024, 1) returns valid detail; non-existent round returns null", async () => {
    const detail = await F1DataService.getRoundDetail(2024, 1);
    assert(detail, "Round 1 detail must exist");
    assert.equal(detail.circuitId, "bahrain");
    assert.equal(detail.countryFlag, "🇧🇭");

    const nonExistent = await F1DataService.getRoundDetail(2024, 99);
    assert.equal(nonExistent, null, "Round 99 should return null");
  });

  // 6. Live API Test: Jolpica getSeasonStandings & Teammate H2H
  await testAsync("F1DataService.getSeasonStandings(2024) returns WDC, WCC, and Teammate H2H battles", async () => {
    const standings = await F1DataService.getSeasonStandings(2024);
    assert(standings, "Standings payload must exist");
    assert.equal(standings.season, 2024);
    assert(standings.drivers.length > 0, "Must have drivers");
    assert(standings.constructors.length > 0, "Must have constructors");
    assert(standings.teammateBattles.length > 0, "Must have teammate battles");
    assert(standings.drivers[0].position === 1, "Leader must be position 1");
    assert(standings.constructors[0].position === 1, "WCC Leader must be position 1");
  });

  // 7. Live API Test: OpenF1 listSessions
  await testAsync("F1DataService.listSessions(2024) returns list of sessions", async () => {
    const sessions = await F1DataService.listSessions(2024);
    assert(Array.isArray(sessions), "Sessions must be an array");
    assert(sessions.length > 0, "Must have sessions for 2024");
    const race = sessions.find((s) => s.session_type === "Race");
    assert(race, "Must include at least one Race session");
  });

  // 8. Live API Test: OpenF1 getTimingData & Replay
  await testAsync("F1DataService.getTimingData calculates timing tower, gaps, and lap replays", async () => {
    const timing = await F1DataService.getTimingData({
      year: 2024,
      country: "Bahrain",
      targetLap: 5,
    });

    assert(timing, "Timing payload must not be null");
    assert.equal(timing.currentLap, 5, "Target lap should be 5");
    assert(timing.totalLaps >= 50, `Total laps ${timing.totalLaps} should be >= 50`);
    assert(timing.tower.length > 0, "Timing tower must contain drivers");
    assert.equal(timing.tower[0].position, 1, "Leader must be position 1");
    assert.equal(timing.tower[0].gapToLeader, "LEADER", "Leader gap must be LEADER");
    assert(timing.drivers.length > 0, "Drivers list must be populated");
    assert(timing.weather, "Weather data must be present");
    assert(typeof timing.weather.airTemp === "number", "Air temp must be number");
  });

  // 9. WDC Simulation Unit Tests: Points & Max Available
  test("computeRemainingMaxPoints calculates correct points with & without Sprint", () => {
    assert.equal(getRacePoints(1), 25);
    assert.equal(getRacePoints(10), 1);
    assert.equal(getRacePoints(11), 0);
    assert.equal(getSprintPoints(1), 8);
    assert.equal(getSprintPoints(8), 1);
    assert.equal(getSprintPoints(9), 0);

    const remainingRaces = [
      { season: 2026, round: 1, raceName: "Standard GP", circuitName: "C1", country: "A", hasSprint: false },
      { season: 2026, round: 2, raceName: "Sprint GP", circuitName: "C2", country: "B", hasSprint: true },
    ];
    // 25 + (25 + 8) = 58
    assert.equal(computeRemainingMaxPoints(remainingRaces), 58);
    assert.equal(computeRemainingMaxPoints([]), 0);
  });

  // 10. WDC Simulation: Title Chances & Elimination Status
  test("evaluateTitleChances detects CHAMPION, CONTENDER, and ELIMINATED status accurately", () => {
    const mockStandings = [
      { driverId: "d1", code: "VER", fullName: "Max Verstappen", teamName: "Red Bull", teamColor: "#3671C6", points: 300, wins: 8, position: 1 },
      { driverId: "d2", code: "NOR", fullName: "Lando Norris", teamName: "McLaren", teamColor: "#FF8000", points: 260, wins: 4, position: 2 },
      { driverId: "d3", code: "LEC", fullName: "Charles Leclerc", teamName: "Ferrari", teamColor: "#E80020", points: 200, wins: 2, position: 3 },
    ];

    // 2 standard races remaining = 50 max points
    const remaining = [
      { season: 2026, round: 23, raceName: "Qatar GP", circuitName: "Lusail", country: "Qatar", hasSprint: false },
      { season: 2026, round: 24, raceName: "Abu Dhabi GP", circuitName: "Yas Marina", country: "UAE", hasSprint: false },
    ];

    const chances = evaluateTitleChances(mockStandings, remaining);
    const ver = chances.find((c) => c.driverId === "d1");
    const nor = chances.find((c) => c.driverId === "d2");
    const lec = chances.find((c) => c.driverId === "d3");

    // Norris: 260 + 50 = 310 >= 300 -> CONTENDER
    assert.equal(nor.status, "CONTENDER");
    // Leclerc: 200 + 50 = 250 < 300 -> ELIMINATED
    assert.equal(lec.status, "ELIMINATED");
    assert.equal(ver.status, "CONTENDER");

    // Now test if only 1 race remaining (25 pts): Norris max = 260 + 25 = 285 < 300 -> Verstappen is CHAMPION
    const oneRaceRemaining = [remaining[1]];
    const clinchingChances = evaluateTitleChances(mockStandings, oneRaceRemaining);
    const verChamp = clinchingChances.find((c) => c.driverId === "d1");
    const norElim = clinchingChances.find((c) => c.driverId === "d2");
    assert.equal(verChamp.status, "CHAMPION");
    assert.equal(norElim.status, "ELIMINATED");
  });

  // 11. WDC Simulation: FIA Tie-Break Countback
  test("compareTieBreak resolves equal points by P1 wins, then P2 countback", () => {
    // Both 250 pts, A has 5 wins, B has 4 wins -> A wins
    const driverA = { points: 250, wins: 5 };
    const driverB = { points: 250, wins: 4 };
    assert(compareTieBreak(driverA, driverB) > 0, "Driver A should win tie-break via more wins");
    assert(compareTieBreak(driverB, driverA) < 0, "Driver B should lose tie-break");

    // Both 250 pts and 3 wins, A has 6 second places, B has 4 second places -> A wins
    const driverC = { points: 250, wins: 3, finishCountback: { 1: 3, 2: 6 } };
    const driverD = { points: 250, wins: 3, finishCountback: { 1: 3, 2: 4 } };
    assert(compareTieBreak(driverC, driverD) > 0, "Driver C should win tie-break via more P2 finishes");
  });

  // 12. WDC Simulation: Earliest Clinch Calculation & Season Almost Over (1 race left)
  test("calculateEarliestClinch detects earliest clinch and 1-race-left scenario", () => {
    const mockStandings = [
      { driverId: "d1", code: "VER", fullName: "Max Verstappen", teamName: "Red Bull", teamColor: "#3671C6", points: 350, wins: 9, position: 1 },
      { driverId: "d2", code: "NOR", fullName: "Lando Norris", teamName: "McLaren", teamColor: "#FF8000", points: 290, wins: 4, position: 2 },
    ];

    // 3 standard races left: round 22 (25 pts), round 23 (25 pts), round 24 (25 pts). Total = 75 pts.
    // Lead = 60 pts.
    // At round 22: if VER wins (+25, total 375), remaining after round 22 = 50 pts.
    // NOR max possible after round 22 = 290 + 50 = 340 < 375.
    // Thus VER can clinch at Round 22!
    const remainingRaces = [
      { season: 2026, round: 22, raceName: "Las Vegas Grand Prix", circuitName: "Strip", country: "USA", hasSprint: false },
      { season: 2026, round: 23, raceName: "Qatar Grand Prix", circuitName: "Lusail", country: "Qatar", hasSprint: false },
      { season: 2026, round: 24, raceName: "Abu Dhabi Grand Prix", circuitName: "Yas Marina", country: "UAE", hasSprint: false },
    ];

    const clinch = calculateEarliestClinch(mockStandings, remainingRaces);
    assert.equal(clinch.canClinchEarly, true);
    assert.equal(clinch.earliestRound, 22);
    assert(clinch.description.includes("Las Vegas Grand Prix"));

    // Edge case: Season completed (0 races left)
    const completedClinch = calculateEarliestClinch(mockStandings, []);
    assert.equal(completedClinch.isAlreadyChampion, true);
  });

  // 13. WDC Simulation: Seeded Monte Carlo Reproducibility
  test("runMonteCarlo produces reproducible results with fixed seed", () => {
    const mockStandings = [
      { driverId: "d1", code: "VER", fullName: "Max Verstappen", teamName: "Red Bull", teamColor: "#3671C6", points: 300, wins: 7, position: 1, recentFinishes: [1, 2, 1, 1, 3] },
      { driverId: "d2", code: "NOR", fullName: "Lando Norris", teamName: "McLaren", teamColor: "#FF8000", points: 285, wins: 5, position: 2, recentFinishes: [2, 1, 2, 3, 1] },
    ];
    const remainingRaces = [
      { season: 2026, round: 24, raceName: "Abu Dhabi Grand Prix", circuitName: "Yas Marina", country: "UAE", hasSprint: false },
    ];

    const run1 = runMonteCarlo(mockStandings, remainingRaces, { simulations: 500, seed: 99999 });
    const run2 = runMonteCarlo(mockStandings, remainingRaces, { simulations: 500, seed: 99999 });

    assert.equal(run1.drivers[0].winProbability, run2.drivers[0].winProbability);
    assert.equal(run1.drivers[0].championshipWins, run2.drivers[0].championshipWins);
    assert.equal(run1.drivers[1].winProbability, run2.drivers[1].winProbability);
  });

  console.log(`\n===========================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});
