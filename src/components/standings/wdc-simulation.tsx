"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Share2,
  Check,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  BarChart2,
  Sliders,
  AlertCircle,
  Info,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  computeRemainingMaxPoints,
  evaluateTitleChances,
  calculateEarliestClinch,
  projectStandings,
  runMonteCarlo,
  DriverStandingInput,
  RemainingRaceEvent,
  CustomFinishSelection,
  MonteCarloResult,
} from "@/lib/f1/simulate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TeamStripe } from "@/components/ui/team-stripe";
import { TeamLogo } from "@/components/ui/team-media";
import { EmptyState } from "@/components/ui/empty-state";

interface WdcSimulationProps {
  season: number;
  standings: DriverStandingInput[];
  remainingRaces: RemainingRaceEvent[];
  totalSeasonRounds: number;
}

type SimSubTab = "CHANCES" | "SCENARIO" | "MONTE_CARLO";

export function WdcSimulation({
  season,
  standings,
  remainingRaces: initialRemainingRaces,
  totalSeasonRounds,
}: WdcSimulationProps) {
  const [subTab, setSubTab] = useState<SimSubTab>("CHANCES");
  const [simRaces, setSimRaces] = useState<RemainingRaceEvent[]>(initialRemainingRaces);

  // Sinkronkan sisa ronde jika prop berubah (misal saat tahun musim diganti)
  useEffect(() => {
    setSimRaces(initialRemainingRaces);
  }, [initialRemainingRaces]);

  const toggleSprint = useCallback((round: number) => {
    setSimRaces((prev) =>
      prev.map((r) =>
        r.round === round ? { ...r, hasSprint: !r.hasSprint } : r
      )
    );
  }, []);

  // ─── EDGE CASES ──────────────────────────────────────────────────────────
  // 1. Musim sudah selesai (tidak ada sisa balapan)
  if (simRaces.length === 0 && standings.length > 0) {
    const leader = standings[0];
    return (
      <Card className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Trophy className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <Badge variant="success">Musim Selesai</Badge>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-text-primary">
            Gelar Juara Dunia F1 {season} Telah Resmi Terkunci
          </h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            Seluruh {totalSeasonRounds} seri balap telah usai.{" "}
            <strong className="text-text-primary">{leader.fullName}</strong> ({leader.teamName}){" "}
            memenangkan Kejuaraan Dunia Pembalap dengan total {leader.points} poin.
          </p>
        </div>
      </Card>
    );
  }

  // 2. Belum ada data race sama sekali (empty state awal musim)
  if (standings.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Data Belum Tersedia"
        description={`Belum ada putaran balapan yang selesai untuk musim ${season}. Simulasi akan aktif setelah balapan perdana selesai.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-text-primary">
            Pusat Simulasi Perebutan Gelar Juara Dunia (WDC)
          </h2>
          <p className="text-xs text-text-secondary">
            Analisis matematis, kalkulator eliminasi, simulator skenario finis, dan proyeksi probabilitas
          </p>
        </div>

        <SegmentedControl<SimSubTab>
          value={subTab}
          onChange={setSubTab}
          size="sm"
          options={[
            { value: "CHANCES", label: "Peluang Matematis" },
            { value: "SCENARIO", label: "Simulator Skenario" },
            { value: "MONTE_CARLO", label: "Prediksi Monte Carlo" },
          ]}
        />
      </div>

      {subTab === "CHANCES" && (
        <TitleChancesSection
          standings={standings}
          remainingRaces={simRaces}
          onToggleSprint={toggleSprint}
        />
      )}

      {subTab === "SCENARIO" && (
        <ScenarioSimulatorSection
          standings={standings}
          remainingRaces={simRaces}
          onToggleSprint={toggleSprint}
        />
      )}

      {subTab === "MONTE_CARLO" && (
        <MonteCarloSection
          season={season}
          standings={standings}
          remainingRaces={simRaces}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. FITUR 1: KALKULATOR "MASIH BISA JUARA?"
// ═════════════════════════════════════════════════════════════════════════════

function TitleChancesSection({
  standings,
  remainingRaces,
  onToggleSprint,
}: {
  standings: DriverStandingInput[];
  remainingRaces: RemainingRaceEvent[];
  onToggleSprint?: (round: number) => void;
}) {
  const chances = useMemo(
    () => evaluateTitleChances(standings, remainingRaces),
    [standings, remainingRaces]
  );

  const clinchScenario = useMemo(
    () => calculateEarliestClinch(standings, remainingRaces),
    [standings, remainingRaces]
  );

  const remainingMaxPoints = useMemo(
    () => computeRemainingMaxPoints(remainingRaces),
    [remainingRaces]
  );

  const sprintCount = useMemo(
    () => remainingRaces.filter((r) => r.hasSprint).length,
    [remainingRaces]
  );

  return (
    <div className="space-y-6">
      {/* Clinch Summary Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Kondisi Penguncian Gelar Tercepat
              </span>
              <p className="font-sans text-sm sm:text-base font-semibold text-text-primary leading-relaxed">
                {clinchScenario.description}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-surface-elevated border border-border-subtle p-3.5 text-left sm:text-right space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
              Poin Maksimum Tersisa
            </span>
            <div className="flex items-baseline justify-start sm:justify-end gap-1.5">
              <span className="font-mono text-3xl font-black text-pitwall-red tabular-nums">
                {remainingMaxPoints}
              </span>
              <span className="text-xs font-bold text-text-secondary">PTS</span>
            </div>
            <div className="text-[11px] font-mono text-text-secondary flex flex-wrap items-center gap-1.5 pt-0.5 sm:justify-end">
              <span className="bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                {remainingRaces.length} GP ({remainingRaces.length * 25}p)
              </span>
              <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold">
                {sprintCount} Sprint ({sprintCount * 8}p)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sisa Ronde & Konfigurasi Sesi Sprint */}
      <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Jadwal Sisa Ronde & Alokasi Balapan Sprint (FIA 8-7-6-5-4-3-2-1)
            </span>
          </div>
          <span className="text-[11px] text-text-muted">
            Klik tombol Sprint pada tiap ronde untuk menyesuaikan simulasi
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {remainingRaces.map((r) => (
            <div
              key={r.round}
              className={`flex flex-col justify-between rounded-lg border p-2.5 transition-all ${
                r.hasSprint
                  ? "bg-purple-950/20 border-purple-500/40"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-pitwall-red">
                    R{r.round}
                  </span>
                  {r.hasSprint ? (
                    <span className="rounded bg-purple-500/20 px-1 py-0.2 font-mono text-[9px] font-extrabold text-purple-400">
                      +8 PTS
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] text-text-muted">
                      STANDAR
                    </span>
                  )}
                </div>
                <div className="mt-1 font-bold text-xs text-text-primary truncate" title={r.raceName}>
                  {r.raceName.replace("Grand Prix", "GP")}
                </div>
              </div>

              {onToggleSprint && (
                <button
                  type="button"
                  onClick={() => onToggleSprint(r.round)}
                  className={`mt-2.5 inline-flex items-center justify-center gap-1 rounded py-1 px-1.5 text-[10px] font-bold transition-all ${
                    r.hasSprint
                      ? "bg-purple-600 text-white hover:bg-purple-500"
                      : "bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle"
                  }`}
                  title={r.hasSprint ? "Hapus sesi Sprint dari ronde ini" : "Aktifkan sesi Sprint untuk ronde ini"}
                >
                  <Zap className="h-3 w-3" />
                  {r.hasSprint ? "Sprint Aktif" : "+ Sprint"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Title Status Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-border-subtle bg-surface-elevated/40 px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Status Kelayakan Matematis Gelar Juara Dunia
          </span>
          <span className="text-xs text-text-muted font-mono">
            {chances.filter((c) => c.status !== "ELIMINATED").length} Pembalap Masih Berpeluang
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-sans" aria-label="Tabel Peluang Juara Dunia F1">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-elevated/20 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th scope="col" className="py-3 px-4 w-14 text-center">Pos</th>
                <th scope="col" className="py-3 px-3">Pembalap</th>
                <th scope="col" className="py-3 px-4 hidden md:table-cell">Tim</th>
                <th scope="col" className="py-3 px-4 text-right">Poin Sekarang</th>
                <th scope="col" className="py-3 px-4 text-right">Poin Maks. Sisa</th>
                <th scope="col" className="py-3 px-4 text-right">Defisit ke P1</th>
                <th scope="col" className="py-3 px-5 text-center w-48">Status Perebutan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {chances.map((c) => {
                const isLeader = c.position === 1;
                return (
                  <tr
                    key={c.driverId}
                    className={`transition-colors hover:bg-surface-hover/70 ${
                      c.status === "ELIMINATED" ? "opacity-60" : ""
                    }`}
                  >
                    {/* Posisi */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold tabular-nums">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isLeader
                            ? "bg-amber-500 text-black font-extrabold"
                            : "text-text-secondary"
                        }`}
                      >
                        {c.position}
                      </span>
                    </td>

                    {/* Pembalap */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamStripe color={c.teamColor} size="sm" />
                        <div>
                          <div className="font-bold text-text-primary flex items-center gap-1.5">
                            <span>{c.fullName}</span>
                            <span className="font-mono text-xs font-semibold text-text-muted">
                              {c.code}
                            </span>
                          </div>
                          <div className="text-xs text-text-muted md:hidden flex items-center gap-1 mt-0.5">
                            <TeamLogo teamName={c.teamName} size={14} priority={false} />
                            <span>{c.teamName}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tim */}
                    <td className="py-3.5 px-4 text-xs font-medium text-text-secondary hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <TeamLogo teamName={c.teamName} size={18} priority={false} />
                        <span>{c.teamName}</span>
                      </div>
                    </td>

                    {/* Poin Sekarang */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-text-primary text-base">
                      {c.currentPoints}
                    </td>

                    {/* Poin Maksimum yang Bisa Diraih */}
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-text-secondary">
                      {c.maxPointsPossible}
                    </td>

                    {/* Defisit ke P1 */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                      {isLeader ? (
                        <span className="font-bold text-emerald-500">LEADER</span>
                      ) : (
                        `-${c.deficitToLeader}`
                      )}
                    </td>

                    {/* Status Badge (Wajib Teks & Ikon) */}
                    <td className="py-3.5 px-5 text-center">
                      {c.status === "CHAMPION" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-extrabold text-amber-500">
                          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Juara Matematis</span>
                        </span>
                      )}

                      {c.status === "CONTENDER" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Masih Berpeluang</span>
                        </span>
                      )}

                      {c.status === "ELIMINATED" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated border border-border-subtle px-2.5 py-1 text-xs font-medium text-text-muted">
                          <XCircle className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                          <span>Tersingkir</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
const RACE_FINISH_OPTIONS: (number | "DNF")[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, "DNF",
];

const SPRINT_FINISH_OPTIONS: (number | "DNF")[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "DNF",
];

function ScenarioSimulatorSection({
  standings,
  remainingRaces,
  onToggleSprint,
}: {
  standings: DriverStandingInput[];
  remainingRaces: RemainingRaceEvent[];
  onToggleSprint?: (round: number) => void;
}) {
  // Pilihan 2-5 pembalap untuk dibandingkan
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(() => {
    return standings.slice(0, 3).map((d) => d.driverId);
  });

  // State kustom finis per ronde
  const [customFinishes, setCustomFinishes] = useState<CustomFinishSelection>({});
  const [copiedLink, setCopiedLink] = useState(false);

  // Baca state awal dari URL params jika ada
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const scenarioParam = url.searchParams.get("scenario");
      const driversParam = url.searchParams.get("drivers");
      if (scenarioParam) {
        const parsed = JSON.parse(decodeURIComponent(scenarioParam));
        if (typeof parsed === "object" && parsed !== null) {
          setCustomFinishes(parsed);
        }
      }
      if (driversParam) {
        const dIds = driversParam.split(",").filter(Boolean);
        if (dIds.length >= 2 && dIds.length <= 5) {
          setSelectedDriverIds(dIds);
        }
      }
    } catch {
      // Abaikan jika parse gagal
    }
  }, []);

  // Simpan skenario ke URL query params secara halus
  const syncUrlParams = useCallback(
    (finishes: CustomFinishSelection, drivers: string[]) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (Object.keys(finishes).length > 0) {
        url.searchParams.set("scenario", encodeURIComponent(JSON.stringify(finishes)));
      } else {
        url.searchParams.delete("scenario");
      }
      url.searchParams.set("drivers", drivers.join(","));
      window.history.replaceState({}, "", url.toString());
    },
    []
  );

  const toggleDriver = (id: string) => {
    setSelectedDriverIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // Minimal 2
        next = prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 5) return prev; // Maksimal 5
        next = [...prev, id];
      }
      syncUrlParams(customFinishes, next);
      return next;
    });
  };

  const handleFinishChange = (
    round: number,
    sessionType: "race" | "sprint",
    driverId: string,
    value: string
  ) => {
    setCustomFinishes((prev) => {
      const copy = { ...prev };
      const roundObj = { ...(copy[round] || {}) };
      const sessionObj = { ...(roundObj[sessionType] || {}) };

      if (value === "") {
        delete sessionObj[driverId];
      } else if (value === "DNF") {
        sessionObj[driverId] = "DNF";
      } else {
        sessionObj[driverId] = Number(value);
      }

      roundObj[sessionType] = sessionObj;
      copy[round] = roundObj;

      syncUrlParams(copy, selectedDriverIds);
      return copy;
    });
  };

  // ─── PRESET CEPAT ────────────────────────────────────────────────────────
  const applyPresetLeaderAlwaysP2 = () => {
    const leaderId = standings[0]?.driverId;
    if (!leaderId) return;

    const nextFinishes: CustomFinishSelection = {};
    for (const r of remainingRaces) {
      nextFinishes[r.round] = {
        race: { [leaderId]: 2 },
        ...(r.hasSprint ? { sprint: { [leaderId]: 2 } } : {}),
      };
    }
    setCustomFinishes(nextFinishes);
    syncUrlParams(nextFinishes, selectedDriverIds);
  };

  const applyPresetChallengerWinsAll = () => {
    const challengerId = standings[1]?.driverId;
    if (!challengerId) return;

    const nextFinishes: CustomFinishSelection = {};
    for (const r of remainingRaces) {
      nextFinishes[r.round] = {
        race: { [challengerId]: 1 },
        ...(r.hasSprint ? { sprint: { [challengerId]: 1 } } : {}),
      };
    }
    setCustomFinishes(nextFinishes);
    syncUrlParams(nextFinishes, selectedDriverIds);
  };

  const applyPresetAverageForm = () => {
    const nextFinishes: CustomFinishSelection = {};
    for (const r of remainingRaces) {
      const raceMap: Record<string, number> = {};
      const sprintMap: Record<string, number> = {};

      for (const dId of selectedDriverIds) {
        const drv = standings.find((d) => d.driverId === dId);
        if (!drv) continue;
        const finishes = (drv.recentFinishes || []).filter(
          (f): f is number => typeof f === "number" && f > 0
        );
        const avg =
          finishes.length > 0
            ? Math.round(finishes.reduce((a, b) => a + b, 0) / finishes.length)
            : drv.position;
        raceMap[dId] = Math.min(20, Math.max(1, avg));
        if (r.hasSprint) {
          sprintMap[dId] = Math.min(20, Math.max(1, avg));
        }
      }

      nextFinishes[r.round] = {
        race: raceMap,
        ...(r.hasSprint ? { sprint: sprintMap } : {}),
      };
    }
    setCustomFinishes(nextFinishes);
    syncUrlParams(nextFinishes, selectedDriverIds);
  };

  const resetPreset = () => {
    setCustomFinishes({});
    syncUrlParams({}, selectedDriverIds);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Hitung proyeksi real-time murni
  const projected = useMemo(
    () => projectStandings(standings, remainingRaces, customFinishes),
    [standings, remainingRaces, customFinishes]
  );

  // Buat dataset grafik garis kumulatif poin per ronde
  const chartData = useMemo(() => {
    const roundsList = remainingRaces.map((r) => r.round);
    return roundsList.map((rnd) => {
      const pointObj: any = { round: `R${rnd}` };
      for (const dId of selectedDriverIds) {
        const item = projected.find((p) => p.driverId === dId);
        pointObj[dId] = item?.cumulativePointsByRound[rnd] ?? item?.currentPoints ?? 0;
      }
      return pointObj;
    });
  }, [remainingRaces, selectedDriverIds, projected]);

  return (
    <div className="space-y-6">
      {/* Driver Chips Selector & Presets Header */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Pilih 2-5 Pembalap untuk Dibandingkan
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {standings.slice(0, 10).map((d) => {
                const isSelected = selectedDriverIds.includes(d.driverId);
                return (
                  <button
                    key={d.driverId}
                    type="button"
                    onClick={() => toggleDriver(d.driverId)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                      isSelected
                        ? "text-white shadow-xs ring-2 ring-offset-2 ring-offset-background"
                        : "bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle"
                    }`}
                    style={{
                      backgroundColor: isSelected ? d.teamColor : undefined,
                      borderColor: isSelected ? d.teamColor : undefined,
                    }}
                    aria-pressed={isSelected}
                  >
                    <span>{d.code}</span>
                    <span className="font-normal opacity-85 text-[11px]">{d.points}p</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Presets & Share Link */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={applyPresetLeaderAlwaysP2}
              className="text-xs"
            >
              Pemimpin Selalu P2
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={applyPresetChallengerWinsAll}
              className="text-xs"
            >
              Pesaing Menang Semua
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={applyPresetAverageForm}
              className="text-xs"
            >
              Rata-rata 5 Race
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetPreset}
              className="text-xs text-text-muted"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyLink}
              className="text-xs ml-auto"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Tersalin!
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 mr-1" />
                  Salin Tautan
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Grid: Left Controls (Races) + Right Projections (Standings & Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL KIRI: DAFTAR RACE & INPUT FINISH (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="border-b border-border-subtle pb-3">
              <h3 className="font-display text-lg font-bold text-text-primary">
                Atur Posisi Finis Pembalap
              </h3>
              <p className="text-xs text-text-muted">
                Pilih proyeksi finis di tiap balapan untuk menghitung klasemen otomatis
              </p>
            </div>

            <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
              {remainingRaces.map((r) => {
                const roundSelection = customFinishes[r.round] || {};
                return (
                  <div
                    key={r.round}
                    className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-pitwall-red">
                          R{r.round}
                        </span>
                        <span className="font-bold text-text-primary text-xs">
                          {r.raceName}
                        </span>
                      </div>
                      {onToggleSprint ? (
                        <button
                          type="button"
                          onClick={() => onToggleSprint(r.round)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold uppercase transition-all ${
                            r.hasSprint
                              ? "bg-purple-600 text-white shadow-xs hover:bg-purple-500"
                              : "bg-surface-elevated text-text-muted hover:text-text-primary border border-dashed border-border-subtle"
                          }`}
                          title={
                            r.hasSprint
                              ? "Hapus sesi Sprint dari ronde ini"
                              : "Tambahkan sesi Sprint ke ronde ini"
                          }
                        >
                          <Zap className="h-3 w-3" />
                          {r.hasSprint ? "Sprint (8 Pts)" : "+ Sprint"}
                        </button>
                      ) : r.hasSprint ? (
                        <span className="rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-400">
                          +SPRINT
                        </span>
                      ) : null}
                    </div>

                    {/* Inputs per Driver */}
                    <div className="space-y-2 pt-1 border-t border-border-subtle/60">
                      {selectedDriverIds.map((dId) => {
                        const drv = standings.find((d) => d.driverId === dId);
                        if (!drv) return null;
                        const raceVal = roundSelection.race?.[dId] ?? "";
                        const sprintVal = roundSelection.sprint?.[dId] ?? "";

                        return (
                          <div
                            key={dId}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-[70px]">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: drv.teamColor }}
                              />
                              <span className="font-bold text-text-primary">
                                {drv.code}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {r.hasSprint && (
                                <div className="flex items-center gap-1">
                                  <span
                                    className="text-[10px] text-purple-400 font-mono font-bold"
                                    title="Sprint Race: P1 (8p) s/d P8 (1p)"
                                  >
                                    S:
                                  </span>
                                  <select
                                    value={sprintVal}
                                    onChange={(e) =>
                                      handleFinishChange(
                                        r.round,
                                        "sprint",
                                        dId,
                                        e.target.value
                                      )
                                    }
                                    className="h-7 rounded border border-purple-500/40 bg-surface px-1.5 text-xs font-mono text-text-primary focus:border-purple-400 focus:outline-none"
                                    aria-label={`Posisi Sprint ${drv.code} R${r.round}`}
                                  >
                                    <option value="">-</option>
                                    {SPRINT_FINISH_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt === "DNF"
                                          ? "DNF (0p)"
                                          : opt <= 8
                                          ? `P${opt} (${9 - opt}p)`
                                          : `P${opt} (0p)`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div className="flex items-center gap-1">
                                <span
                                  className="text-[10px] text-text-muted font-mono font-bold"
                                  title="Grand Prix Race: P1 (25p) s/d P10 (1p)"
                                >
                                  R:
                                </span>
                                <select
                                  value={raceVal}
                                  onChange={(e) =>
                                    handleFinishChange(
                                      r.round,
                                      "race",
                                      dId,
                                      e.target.value
                                    )
                                  }
                                  className="h-7 rounded border border-border-subtle bg-surface px-1.5 text-xs font-mono text-text-primary focus:border-pitwall-red focus:outline-none"
                                  aria-label={`Posisi Race ${drv.code} R${r.round}`}
                                >
                                  <option value="">-</option>
                                  {RACE_FINISH_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt === "DNF"
                                        ? "DNF (0p)"
                                        : opt === 1
                                        ? "P1 (25p)"
                                        : opt === 2
                                        ? "P2 (18p)"
                                        : opt === 3
                                        ? "P3 (15p)"
                                        : opt === 4
                                        ? "P4 (12p)"
                                        : opt === 5
                                        ? "P5 (10p)"
                                        : opt === 6
                                        ? "P6 (8p)"
                                        : opt === 7
                                        ? "P7 (6p)"
                                        : opt === 8
                                        ? "P8 (4p)"
                                        : opt === 9
                                        ? "P9 (2p)"
                                        : opt === 10
                                        ? "P10 (1p)"
                                        : `P${opt} (0p)`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* PANEL KANAN: HASIL KLASEMEN PROYEKSI & GRAFIK (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Grafik Garis Akumulasi Poin */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-text-primary">
                  Proyeksi Perjalanan Poin Pembalap
                </h3>
                <p className="text-xs text-text-muted">
                  Grafik garis akumulasi poin dari start ronde sisa hingga akhir musim
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-text-muted" />
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="round"
                    stroke="#71717A"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#71717A"
                    fontSize={11}
                    tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border-subtle)",
                      borderRadius: "8px",
                      color: "var(--color-text-primary)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  />
                  {selectedDriverIds.map((dId) => {
                    const drv = standings.find((d) => d.driverId === dId);
                    if (!drv) return null;
                    return (
                      <Line
                        key={dId}
                        type="monotone"
                        dataKey={dId}
                        name={drv.fullName}
                        stroke={drv.teamColor}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: drv.teamColor }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Tabel Klasemen Hasil Proyeksi */}
          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle bg-surface-elevated/40 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Klasemen Proyeksi Akhir Musim
              </span>
              <span className="text-xs text-emerald-500 font-bold font-mono">
                P1: {projected[0]?.fullName} ({projected[0]?.projectedPoints} PTS)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans" aria-label="Tabel Proyeksi Klasemen Akhir Musim">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-elevated/20 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4 w-12 text-center">Pos</th>
                    <th scope="col" className="py-3 px-2 w-10 text-center">Δ</th>
                    <th scope="col" className="py-3 px-3">Pembalap</th>
                    <th scope="col" className="py-3 px-4 text-right">Poin Proyeksi</th>
                    <th scope="col" className="py-3 px-4 text-right">Poin Asal</th>
                    <th scope="col" className="py-3 px-4 text-center">Gelar Juara</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {projected.map((item) => (
                    <tr
                      key={item.driverId}
                      className={`transition-colors hover:bg-surface-hover/70 ${
                        item.isProjectedChampion ? "bg-amber-500/5 font-semibold" : ""
                      }`}
                    >
                      {/* Pos Proyeksi */}
                      <td className="py-3 px-4 text-center font-mono font-bold tabular-nums">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            item.projectedPosition === 1
                              ? "bg-amber-500 text-black font-extrabold"
                              : "text-text-secondary"
                          }`}
                        >
                          {item.projectedPosition}
                        </span>
                      </td>

                      {/* Delta Posisi */}
                      <td className="py-3 px-2 text-center font-mono text-xs tabular-nums">
                        {item.positionChange > 0 ? (
                          <span className="flex items-center justify-center text-emerald-500 font-bold">
                            <TrendingUp className="h-3.5 w-3.5 mr-0.5" />
                            +{item.positionChange}
                          </span>
                        ) : item.positionChange < 0 ? (
                          <span className="flex items-center justify-center text-rose-500 font-bold">
                            <TrendingDown className="h-3.5 w-3.5 mr-0.5" />
                            {item.positionChange}
                          </span>
                        ) : (
                          <span className="flex items-center justify-center text-text-muted">
                            <Minus className="h-3 w-3" />
                          </span>
                        )}
                      </td>

                      {/* Nama Pembalap */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <TeamStripe color={item.teamColor} size="sm" />
                          <div>
                            <div className="font-bold text-text-primary text-xs sm:text-sm">
                              {item.fullName}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {item.teamName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Poin Proyeksi */}
                      <td className="py-3 px-4 text-right font-mono font-extrabold tabular-nums text-text-primary text-base">
                        {item.projectedPoints}
                      </td>

                      {/* Poin Asal */}
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-text-muted">
                        {item.currentPoints}
                      </td>

                      {/* Juara Tag */}
                      <td className="py-3 px-4 text-center">
                        {item.isProjectedChampion ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-extrabold text-amber-500">
                            <Trophy className="h-3.5 w-3.5" />
                            <span>JUARA</span>
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. FITUR 3: PROBABILITAS MONTE CARLO (10.000 SIMULASI VIA WEB WORKER)
// ═════════════════════════════════════════════════════════════════════════════

function MonteCarloSection({
  season,
  standings,
  remainingRaces,
}: {
  season: number;
  standings: DriverStandingInput[];
  remainingRaces: RemainingRaceEvent[];
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const runSimulation = () => {
    setIsRunning(true);
    setProgress(5);
    setSimError(null);

    // Coba gunakan Web Worker jika tersedia di browser
    if (typeof window !== "undefined" && window.Worker) {
      try {
        const worker = new Worker(
          new URL("@/lib/f1/monte-carlo.worker.ts", import.meta.url)
        );

        worker.onmessage = (event) => {
          const data = event.data;
          if (data.type === "PROGRESS") {
            setProgress(data.progress);
          } else if (data.type === "DONE") {
            setResult(data.result);
            setIsRunning(false);
            setProgress(100);
            worker.terminate();
          } else if (data.type === "ERROR") {
            setSimError(data.error);
            setIsRunning(false);
            worker.terminate();
          }
        };

        worker.onerror = () => {
          // Fallback sinkron jika worker error
          worker.terminate();
          runFallbackSync();
        };

        worker.postMessage({
          standings,
          remainingRaces,
          simulations: 10000,
          seed: Date.now(),
        });
        return;
      } catch {
        // Fallback ke sinkron jika worker tidak bisa dibuat
      }
    }

    runFallbackSync();
  };

  const runFallbackSync = () => {
    setTimeout(() => {
      try {
        const res = runMonteCarlo(standings, remainingRaces, {
          simulations: 10000,
          seed: Date.now(),
          onProgress: (p) => setProgress(p),
        });
        setResult(res);
      } catch (err: any) {
        setSimError(err?.message || "Gagal menjalankan simulasi.");
      } finally {
        setIsRunning(false);
        setProgress(100);
      }
    }, 50);
  };

  const sprintCount = useMemo(
    () => remainingRaces.filter((r) => r.hasSprint).length,
    [remainingRaces]
  );

  return (
    <div className="space-y-6">
      {/* Simulation Header Banner */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 max-w-xl">
            <h3 className="font-display text-lg sm:text-xl font-bold text-text-primary">
              Simulasi Monte Carlo (10.000 Skenario Musim)
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Mensimulasikan seluruh sisa{" "}
              <strong className="text-text-primary">{remainingRaces.length} Grand Prix</strong>
              {sprintCount > 0 ? (
                <>
                  {" "}dan{" "}
                  <strong className="text-purple-400">{sprintCount} Balapan Sprint</strong>
                </>
              ) : null}{" "}
              sebanyak 10.000 kali menggunakan distribusi performa finis pembalap 5-8 race terakhir
              (dengan pembobotan tren terbaru) dan probabilitas DNF riil.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={runSimulation}
            disabled={isRunning}
            className="shrink-0 font-bold"
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Mensimulasikan... {progress}%</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-white" />
                <span>Hitung Peluang Juara</span>
              </span>
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="mt-5 space-y-1.5" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress Simulasi Monte Carlo">
            <div className="flex justify-between text-xs font-mono text-text-muted">
              <span>Menghitung 10.000 iterasi di Web Worker...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full bg-pitwall-red transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {simError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            {simError}
          </div>
        )}
      </Card>

      {/* Results Display */}
      {result && (
        <div className="space-y-6">
          {/* Win Probability Bar List */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="border-b border-border-subtle pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-bold text-text-primary">
                  Peluang Juara Dunia Pembalap (Win Probability)
                </h4>
                <p className="text-xs text-text-muted">
                  Berdasarkan {result.simulationsRun.toLocaleString()} iterasi simulasi
                </p>
              </div>
              <BarChart2 className="h-5 w-5 text-text-muted" />
            </div>

            <div className="space-y-4">
              {result.drivers.slice(0, 8).map((d) => (
                <div key={d.driverId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <TeamStripe color={d.teamColor} size="sm" />
                      <span className="font-bold text-text-primary text-sm">
                        {d.fullName}
                      </span>
                      <span className="font-mono text-xs text-text-muted">
                        ({d.teamName})
                      </span>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span className="font-extrabold text-text-primary text-base">
                        {d.winProbability.toFixed(1)}%
                      </span>
                      <span className="text-text-muted text-[11px] ml-1.5">
                        ({d.championshipWins.toLocaleString()} juara)
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-3 w-full rounded-full bg-surface-elevated overflow-hidden border border-border-subtle/50">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(d.winProbability > 0 ? 1 : 0, d.winProbability)}%`,
                        backgroundColor: d.teamColor || "var(--color-accent)",
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-mono text-text-muted pt-0.5">
                    <span>Poin saat ini: {d.currentPoints}</span>
                    <span>
                      Estimasi Rata-rata: <strong>{d.avgPoints} PTS</strong> (Rentang: {d.minPoints} - {d.maxPoints})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Histogram Sebaran Poin Top 3 Contenders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.drivers.slice(0, 3).map((d) => (
              <Card key={d.driverId} className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <TeamStripe color={d.teamColor} size="sm" />
                    <span className="font-bold text-text-primary text-xs">
                      {d.code} - Sebaran Poin
                    </span>
                  </div>
                  <span className="font-mono text-xs font-black text-pitwall-red">
                    {d.winProbability}%
                  </span>
                </div>

                {/* Histogram Bars */}
                <div className="space-y-1.5 pt-1">
                  {d.histogram.map((bin, bIdx) => (
                    <div key={bIdx} className="space-y-0.5">
                      <div className="flex justify-between text-[10px] font-mono text-text-muted">
                        <span>
                          {bin.binStart}-{bin.binEnd} PTS
                        </span>
                        <span>{bin.percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${bin.percentage}%`,
                            backgroundColor: d.teamColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Keterangan Wajib / Metodologi Transparan */}
          <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4 flex items-start gap-3 text-xs text-text-secondary leading-relaxed">
            <Info className="h-4 w-4 shrink-0 text-text-muted mt-0.5" />
            <div>
              <p className="font-semibold text-text-primary">
                Keterangan Metodologi Statistik
              </p>
              <p className="mt-0.5 text-text-muted">
                Ini perkiraan statistik dari hasil musim ini, bukan prediksi pasti. Dihitung melalui{" "}
                <strong>{result.simulationsRun.toLocaleString()} iterasi simulasi</strong> Monte Carlo untuk{" "}
                <strong>{result.racesSimulated} seri balap sisa</strong> berdasarkan distribusi riil hasil balapan dan
                tingkat keandalan mekanis (DNF) musim {season}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

