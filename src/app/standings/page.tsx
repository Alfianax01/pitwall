"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StandingsPayload, CalendarEvent } from "@/lib/f1/schemas";
import { useUI } from "@/components/providers";
import { Trophy, ChevronRight, Users, Shield } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Card } from "@/components/ui/card";
import { TeamStripe } from "@/components/ui/team-stripe";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamLogo, TeamCarBackground } from "@/components/ui/team-media";
import { WdcSimulation } from "@/components/standings/wdc-simulation";

type EnrichedStandingsPayload = StandingsPayload & {
  drivers: (StandingsPayload["drivers"][number] & {
    headshotUrl?: string | null;
  })[];
  teammateBattles: {
    constructorId: string;
    teamName: string;
    teamColor: string;
    driverA: StandingsPayload["teammateBattles"][number]["driverA"] & {
      headshotUrl?: string | null;
    };
    driverB: StandingsPayload["teammateBattles"][number]["driverB"] & {
      headshotUrl?: string | null;
    };
  }[];
};

type StandingsTab = "WDC" | "WCC" | "H2H" | "SIMULATION";

// Driver avatar helper (returns headshot image or stylized initials with team color)
function DriverAvatar({
  name,
  code,
  headshotUrl,
  teamColor,
  size = "md",
}: {
  name: string;
  code: string;
  headshotUrl?: string | null;
  teamColor: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-sm",
  };

  if (headshotUrl) {
    return (
      <div
        className={`relative ${sizeMap[size]} shrink-0 overflow-hidden rounded-full border border-border-subtle bg-surface-elevated`}
      >
        <img
          src={headshotUrl}
          alt={name}
          className="h-full w-full object-cover object-top"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: Stylized initial badge with team color
  return (
    <div
      className={`flex ${sizeMap[size]} shrink-0 items-center justify-center rounded-full font-display font-extrabold text-white shadow-xs`}
      style={{ backgroundColor: teamColor || "#E10600" }}
      title={name}
    >
      {code ? code.slice(0, 3) : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function StandingsPage() {
  const { locale, t } = useUI();
  const currentYear = new Date().getFullYear();
  const [season, setSeason] = useState<number>(currentYear);
  const [activeTab, setActiveTab] = useState<StandingsTab>("WDC");

  const { data, isLoading, isError, refetch } = useQuery<EnrichedStandingsPayload>({
    queryKey: ["f1-standings", season],
    queryFn: async () => {
      const res = await fetch(`/api/f1/standings?year=${season}`);
      if (!res.ok) throw new Error("Gagal memuat klasemen");
      return res.json();
    },
  });

  // Query Kalender untuk menghitung ronde dan sprint yang tersisa secara akurat dari data
  const { data: calendarData } = useQuery<{
    season: number;
    events: CalendarEvent[];
  }>({
    queryKey: ["f1-calendar", season],
    queryFn: async () => {
      const res = await fetch(`/api/f1/calendar?year=${season}`);
      if (!res.ok) throw new Error("Gagal memuat kalender");
      return res.json();
    },
  });

  const remainingRaces = useMemo(() => {
    const events = calendarData?.events || [];
    return events
      .filter((e) => e.status !== "COMPLETED")
      .map((e) => ({
        season: e.season,
        round: e.round,
        raceName: e.raceName,
        circuitName: e.circuitName,
        country: e.country,
        hasSprint: e.sessions.some((s) => s.key === "SPRINT"),
        status: e.status,
      }));
  }, [calendarData]);

  const drivers = useMemo(() => data?.drivers || [], [data]);
  const constructors = useMemo(() => data?.constructors || [], [data]);
  const teammateBattles = useMemo(() => data?.teammateBattles || [], [data]);

  // Podium Top 3 Drivers in visual sports broadcast order: P2 (Left), P1 (Center), P3 (Right)
  const podiumDrivers = useMemo(() => {
    if (drivers.length < 3) return null;
    const p1 = drivers[0];
    const p2 = drivers[1];
    const p3 = drivers[2];
    return { p1, p2, p3 };
  }, [drivers]);

  // Remaining drivers: P4 to P20+
  const restDrivers = useMemo(() => {
    return drivers.length > 3 ? drivers.slice(3) : [];
  }, [drivers]);

  return (
    <div className="space-y-8 pb-16">
      {/* ─── 1. HEADER & CONTROL TOOLBAR ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary">
            Klasemen Kejuaraan Dunia F1
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">
            Poin resmi dan statistik musim balap Formula 1 {data?.season || season}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Tab Switcher */}
          <SegmentedControl<StandingsTab>
            value={activeTab}
            onChange={setActiveTab}
            size="sm"
            options={[
              { value: "WDC", label: "Pembalap" },
              { value: "WCC", label: "Konstruktor" },
              { value: "H2H", label: "Duel Rekan Tim" },
              { value: "SIMULATION", label: "Simulasi WDC" },
            ]}
          />

          {/* Season Selector */}
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
            aria-label="Pilih Musim Klasemen"
          >
            {[2026, 2025, 2024, 2023, 2022, 2021].map((yr) => (
              <option key={yr} value={yr}>
                Musim {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── 2. LOADING & ERROR STATES ───────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon={Trophy}
          title="Gagal Mengambil Data Klasemen"
          description={`Terjadi kesalahan saat memuat data klasemen musim ${season}.`}
          actionLabel="Muat Ulang"
          onAction={() => refetch()}
        />
      )}

      {/* ─── 3. TAB 1: KLASEMEN PEMBALAP (WDC) ───────────────────────────── */}
      {!isLoading && !isError && activeTab === "WDC" && (
        <div className="space-y-6">
          {/* PODIUM 3 TERATAS HERO (P2 - P1 - P3) */}
          {podiumDrivers && (
            <section
              aria-label="Podium Pemimpin Kejuaraan"
              className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end pt-4"
            >
              {/* P2: KIRI (Silver / 2nd tallest) */}
              <PodiumCard
                driver={podiumDrivers.p2}
                rank={2}
                heightClass="h-72"
                season={data?.season || season}
              />

              {/* P1: TENGAH (Gold / Tallest & Largest, Leader) */}
              <PodiumCard
                driver={podiumDrivers.p1}
                rank={1}
                heightClass="h-84 md:-mt-4"
                isLeader
                season={data?.season || season}
              />

              {/* P3: KANAN (Bronze / 3rd tallest) */}
              <PodiumCard
                driver={podiumDrivers.p3}
                rank={3}
                heightClass="h-64"
                season={data?.season || season}
              />
            </section>
          )}

          {/* TABEL PEMBALAP SISANYA (P4 - P20+) */}
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle bg-surface-elevated/40 px-5 py-3">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Klasifikasi Poin Pembalap
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-elevated/20 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <th className="py-3 px-4 w-14 text-center">Pos</th>
                    <th className="py-3 px-3">Pembalap</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Tim</th>
                    <th className="py-3 px-4 text-right">Menang</th>
                    <th className="py-3 px-4 text-right">Poin</th>
                    <th className="py-3 px-4 text-right">Selisih P1</th>
                    <th className="py-3 px-4 hidden lg:table-cell w-44">
                      Distribusi Poin
                    </th>
                    <th className="py-3 pr-5 pl-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {drivers.map((drv) => (
                    <tr
                      key={drv.driverId}
                      className="group cursor-pointer hover:bg-surface-hover/70 transition-colors"
                      onClick={() => {
                        window.location.href = `/drivers/${drv.driverId}?year=${data?.season || season}`;
                      }}
                    >
                      {/* Posisi */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold tabular-nums">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            drv.position === 1
                              ? "bg-amber-500 text-black font-extrabold"
                              : drv.position === 2
                                ? "bg-slate-300 dark:bg-slate-700 text-text-primary font-bold"
                                : drv.position === 3
                                  ? "bg-amber-700/60 text-white font-bold"
                                  : "text-text-secondary"
                          }`}
                        >
                          {drv.position}
                        </span>
                      </td>

                      {/* Driver Avatar + TeamStripe + Name */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <DriverAvatar
                            name={drv.fullName}
                            code={drv.code}
                            headshotUrl={drv.headshotUrl}
                            teamColor={drv.teamColor}
                            size="md"
                          />
                          <TeamStripe color={drv.teamColor} size="md" />
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-text-primary group-hover:text-pitwall-red transition-colors">
                              <span>{drv.fullName}</span>
                              <span className="font-mono text-xs font-semibold text-text-muted">
                                {drv.code}
                              </span>
                            </div>
                            <div className="text-xs text-text-muted font-medium sm:hidden flex items-center gap-1.5 mt-0.5">
                              <TeamLogo teamName={drv.teamName} size={16} priority={false} />
                              <span>{drv.teamName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Team Name dengan Logo 20px */}
                      <td className="py-3.5 px-4 text-xs font-medium text-text-secondary hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <TeamLogo teamName={drv.teamName} size={20} priority={false} />
                          <span>{drv.teamName}</span>
                        </div>
                      </td>

                      {/* Wins */}
                      <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                        {drv.wins > 0 ? (
                          <span className="font-bold text-amber-500">
                            {drv.wins}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Points */}
                      <td className="py-3.5 px-4 text-right font-mono text-base font-extrabold tabular-nums text-text-primary">
                        {drv.points}
                      </td>

                      {/* Delta to P1 */}
                      <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                        {drv.position === 1 ? (
                          <span className="font-bold text-emerald-500">LEADER</span>
                        ) : (
                          `-${drv.gapToLeader}`
                        )}
                      </td>

                      {/* Neutral Progress Bar */}
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
                          <div
                            className="h-full bg-text-primary/40 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, drv.pointsRatio)}%` }}
                          />
                        </div>
                      </td>

                      {/* Hover Arrow */}
                      <td className="py-3.5 pr-5 pl-2 text-right">
                        <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── 4. TAB 2: KLASEMEN KONSTRUKTOR (WCC) ─────────────────────────── */}
      {!isLoading && !isError && activeTab === "WCC" && (
        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle bg-surface-elevated/40 px-5 py-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Klasifikasi Kejuaraan Konstruktor
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-sans">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated/20 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">Pos</th>
                  <th className="py-3 px-4">Konstruktor</th>
                  <th className="py-3 px-4">Kebangsaan</th>
                  <th className="py-3 px-4 text-right">Kemenangan</th>
                  <th className="py-3 px-4 text-right">Poin</th>
                  <th className="py-3 px-4 text-right">Selisih P1</th>
                  <th className="py-3 px-4 hidden md:table-cell w-56">
                    Pangsa Poin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {constructors.map((con) => (
                  <tr
                    key={con.constructorId}
                    className="hover:bg-surface-hover/70 transition-colors"
                  >
                    <td className="py-4 px-4 text-center font-mono font-bold tabular-nums">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          con.position === 1
                            ? "bg-amber-500 text-black font-extrabold"
                            : "text-text-secondary"
                        }`}
                      >
                        {con.position}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <TeamStripe color={con.teamColor} size="lg" />
                        <TeamLogo teamName={con.teamName} size={36} priority={false} />
                        <div>
                          <div className="font-bold text-text-primary text-base">
                            {con.teamName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs text-text-secondary font-medium">
                      {con.nationality}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                      {con.wins > 0 ? (
                        <span className="font-bold text-amber-500">
                          {con.wins}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-base font-extrabold tabular-nums text-text-primary">
                      {con.points}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                      {con.position === 1 ? (
                        <span className="font-bold text-emerald-500">LEADER</span>
                      ) : (
                        `-${con.gapToLeader}`
                      )}
                    </td>
                    <td className="py-4 px-4 hidden md:table-cell">
                      <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, con.pointsRatio)}%`,
                            backgroundColor: con.teamColor,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── 5. TAB 3: DUEL REKAN TIM (H2H) ───────────────────────────────── */}
      {!isLoading && !isError && activeTab === "H2H" && (
        <div className="grid gap-4 md:grid-cols-2">
          {teammateBattles.map((battle) => {
            const totalPts = Math.max(
              1,
              battle.driverA.points + battle.driverB.points
            );
            const pctPtsA = Math.round(
              (battle.driverA.points / totalPts) * 100
            );

            const totalQuali = Math.max(
              1,
              battle.driverA.qualiWins + battle.driverB.qualiWins
            );
            const pctQualiA = Math.round(
              (battle.driverA.qualiWins / totalQuali) * 100
            );

            const totalRace = Math.max(
              1,
              battle.driverA.raceWins + battle.driverB.raceWins
            );
            const pctRaceA = Math.round(
              (battle.driverA.raceWins / totalRace) * 100
            );

            return (
              <Card key={battle.constructorId} className="overflow-hidden">
                {/* Team Header */}
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface-elevated/40 px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <TeamStripe color={battle.teamColor} size="md" />
                    <TeamLogo teamName={battle.teamName} size={20} priority={false} />
                    <span className="font-bold text-text-primary text-sm">
                      {battle.teamName}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-text-muted">
                    Head-to-Head
                  </span>
                </div>

                {/* Driver Matchup Header */}
                <div className="grid grid-cols-2 divide-x divide-border-subtle p-4 border-b border-border-subtle">
                  <div className="flex items-center gap-3">
                    <DriverAvatar
                      name={battle.driverA.fullName}
                      code={battle.driverA.code}
                      headshotUrl={battle.driverA.headshotUrl}
                      teamColor={battle.teamColor}
                      size="md"
                    />
                    <div>
                      <div className="font-bold text-text-primary">
                        {battle.driverA.code}
                      </div>
                      <div className="text-xs text-text-secondary truncate">
                        {battle.driverA.fullName}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row-reverse items-center gap-3 pl-4 text-right">
                    <DriverAvatar
                      name={battle.driverB.fullName}
                      code={battle.driverB.code}
                      headshotUrl={battle.driverB.headshotUrl}
                      teamColor={battle.teamColor}
                      size="md"
                    />
                    <div>
                      <div className="font-bold text-text-primary">
                        {battle.driverB.code}
                      </div>
                      <div className="text-xs text-text-secondary truncate">
                        {battle.driverB.fullName}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison Bars */}
                <div className="space-y-4 p-5 text-xs">
                  {/* Qualifying Duel */}
                  <div>
                    <div className="mb-1.5 flex justify-between font-mono text-xs tabular-nums">
                      <span className="font-extrabold text-text-primary">
                        {battle.driverA.qualiWins}
                      </span>
                      <span className="font-sans font-semibold text-text-muted uppercase text-[11px] tracking-wider">
                        Qualifying Head-to-Head
                      </span>
                      <span className="font-extrabold text-text-primary">
                        {battle.driverB.qualiWins}
                      </span>
                    </div>
                    <div className="flex h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        style={{
                          width: `${pctQualiA}%`,
                          backgroundColor: battle.teamColor,
                        }}
                        className="h-full"
                      />
                      <div
                        style={{ width: `${100 - pctQualiA}%` }}
                        className="h-full bg-border-strong"
                      />
                    </div>
                  </div>

                  {/* Race Duel */}
                  <div>
                    <div className="mb-1.5 flex justify-between font-mono text-xs tabular-nums">
                      <span className="font-extrabold text-text-primary">
                        {battle.driverA.raceWins}
                      </span>
                      <span className="font-sans font-semibold text-text-muted uppercase text-[11px] tracking-wider">
                        Hasil Finis Balapan
                      </span>
                      <span className="font-extrabold text-text-primary">
                        {battle.driverB.raceWins}
                      </span>
                    </div>
                    <div className="flex h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        style={{
                          width: `${pctRaceA}%`,
                          backgroundColor: battle.teamColor,
                        }}
                        className="h-full"
                      />
                      <div
                        style={{ width: `${100 - pctRaceA}%` }}
                        className="h-full bg-border-strong"
                      />
                    </div>
                  </div>

                  {/* Points Share */}
                  <div>
                    <div className="mb-1.5 flex justify-between font-mono text-xs tabular-nums">
                      <span className="font-extrabold text-text-primary">
                        {battle.driverA.points} PTS
                      </span>
                      <span className="font-sans font-semibold text-text-muted uppercase text-[11px] tracking-wider">
                        Kontribusi Poin Tim
                      </span>
                      <span className="font-extrabold text-text-primary">
                        {battle.driverB.points} PTS
                      </span>
                    </div>
                    <div className="flex h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        style={{
                          width: `${pctPtsA}%`,
                          backgroundColor: battle.teamColor,
                        }}
                        className="h-full"
                      />
                      <div
                        style={{ width: `${100 - pctPtsA}%` }}
                        className="h-full bg-border-strong"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── 6. TAB 4: SIMULASI WDC ───────────────────────────────────────── */}
      {!isLoading && !isError && activeTab === "SIMULATION" && (
        <WdcSimulation
          season={data?.season || season}
          standings={drivers.map((d) => ({
            driverId: d.driverId,
            code: d.code,
            fullName: d.fullName,
            teamName: d.teamName,
            teamColor: d.teamColor,
            points: d.points,
            wins: d.wins,
            position: d.position,
          }))}
          remainingRaces={remainingRaces}
          totalSeasonRounds={calendarData?.events?.length || 24}
        />
      )}
    </div>
  );
}

// ─── PODIUM CARD COMPONENT (P2 - P1 - P3) ──────────────────────────────────
function PodiumCard({
  driver,
  rank,
  heightClass = "h-72",
  isLeader = false,
  season,
}: {
  driver: EnrichedStandingsPayload["drivers"][number] & {
    headshotUrl?: string | null;
  };
  rank: 1 | 2 | 3;
  heightClass?: string;
  isLeader?: boolean;
  season: number;
}) {
  const rankColors = {
    1: { badge: "bg-amber-500 text-black", border: "border-amber-500/40" },
    2: { badge: "bg-slate-300 dark:bg-slate-700 text-text-primary", border: "border-border-subtle" },
    3: { badge: "bg-amber-700/60 text-white", border: "border-border-subtle" },
  };

  const badgeConfig = rankColors[rank];

  return (
    <Link
      href={`/drivers/${driver.driverId}?year=${season}`}
      className="group block focus:outline-none"
    >
      <div
        className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border ${badgeConfig.border} bg-surface p-5 sm:p-6 transition-all duration-200 group-hover:border-border-strong group-hover:shadow-md ${heightClass}`}
      >
        {/* Subtle team color gradient in background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10 transition-opacity group-hover:opacity-15"
          style={{
            background: `radial-gradient(circle at top right, ${driver.teamColor}, transparent 70%)`,
          }}
        />

        {/* Gambar mobil sebagai elemen latar di bawah kartu (opacity ~0.25, rata kanan) */}
        <TeamCarBackground teamName={driver.teamName} priority={true} />

        {/* Large watermark car number/rank in background */}
        <div className="pointer-events-none absolute -right-3 -top-6 font-display text-8xl font-black text-text-primary/5 select-none">
          {rank}
        </div>

        {/* Top: Rank badge + Team Logo di pojok kanan atas (ganti teks nama tim) */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-black shadow-xs ${badgeConfig.badge}`}
            >
              P{rank}
            </span>
            {isLeader && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                Leader
              </span>
            )}
          </div>
          <TeamLogo teamName={driver.teamName} size={32} priority={true} />
        </div>

        {/* Center: Driver Headshot (Large, neatly cropped) */}
        <div className="relative z-10 my-auto flex justify-center py-2">
          {driver.headshotUrl ? (
            <div
              className={`relative ${
                isLeader ? "h-32 w-32" : "h-24 w-24"
              } overflow-hidden rounded-full border-2 border-surface-elevated bg-surface-elevated/70 shadow-sm transition-transform duration-300 group-hover:scale-105`}
            >
              <img
                src={driver.headshotUrl}
                alt={driver.fullName}
                className="h-full w-full object-cover object-top"
              />
            </div>
          ) : (
            <div
              className={`flex ${
                isLeader ? "h-32 w-32 text-3xl" : "h-24 w-24 text-2xl"
              } items-center justify-center rounded-full font-display font-extrabold text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}
              style={{ backgroundColor: driver.teamColor || "#E10600" }}
            >
              {driver.code}
            </div>
          )}
        </div>

        {/* Bottom: Driver Name & Points */}
        <div className="relative z-10 border-t border-border-subtle pt-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-text-primary group-hover:text-pitwall-red transition-colors">
                {driver.fullName}
              </h3>
              <p className="text-xs text-text-muted font-medium">
                {driver.nationality}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl sm:text-3xl font-black tabular-nums text-text-primary">
                {driver.points}
              </div>
              <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                {driver.wins} {driver.wins === 1 ? "Menang" : "Menang"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
