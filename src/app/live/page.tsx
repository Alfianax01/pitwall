"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TimingPayload, TimingTowerRow } from "@/lib/f1/schemas";
import { formatLapTime } from "@/lib/f1";
import { TyreIcon } from "@/components/ui/tyre-icon";
import { TeamStripe } from "@/components/ui/team-stripe";
import { TrackMap } from "@/components/track-map";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Play,
  Pause,
  RotateCcw,
  Thermometer,
  CloudRain,
  Wind,
  LineChart,
  Radio,
  Flag,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface SessionItem {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

interface MeetingGroup {
  meeting_key: number;
  country_name: string;
  circuit_short_name: string;
  location: string;
  year: number;
  sessions: SessionItem[];
}

const SECTOR_COLOR_BAR: Record<string, string> = {
  PURPLE: "bg-purple-500",
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-400",
  NONE: "bg-surface-elevated",
};

function LiveTimingContent() {
  const searchParams = useSearchParams();
  const rawYear = searchParams.get("year") || searchParams.get("season");
  const initialYear = Number(rawYear) || new Date().getFullYear();
  const initialCountry = searchParams.get("country") || "";
  const rawSessionKey =
    searchParams.get("session_key") || searchParams.get("sessionKey");
  const initialSessionKey = rawSessionKey ? Number(rawSessionKey) : undefined;

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<
    number | undefined
  >(undefined);
  const [selectedSessionKey, setSelectedSessionKey] = useState<
    number | undefined
  >(initialSessionKey);

  const [replayLap, setReplayLap] = useState<number | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [focusedDriver, setFocusedDriver] = useState<number | null>(null);
  const [pitLossSeconds, setPitLossSeconds] = useState<number>(22.0);
  const [hideBlueFlags, setHideBlueFlags] = useState<boolean>(true);

  // Fetch Sirkuit & Sesi list
  const { data: sessionsData } = useQuery<{
    resolvedYear: number;
    meetings: MeetingGroup[];
    sessions: SessionItem[];
  }>({
    queryKey: ["f1-sessions-grouped", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/f1/sessions?year=${selectedYear}`);
      if (!res.ok) throw new Error("Gagal memuat daftar sirkuit");
      return res.json();
    },
  });

  const meetings = useMemo(
    () => sessionsData?.meetings || [],
    [sessionsData]
  );

  // Synchronize circuit and session selection
  useEffect(() => {
    if (!meetings.length) return;

    if (selectedSessionKey) {
      const foundMeeting = meetings.find((m) =>
        m.sessions.some((s) => s.session_key === selectedSessionKey)
      );
      if (foundMeeting) {
        setSelectedMeetingKey(foundMeeting.meeting_key);
        return;
      }
    }

    const defaultMeeting = initialCountry
      ? meetings.find((m) =>
          m.country_name.toLowerCase().includes(initialCountry.toLowerCase())
        ) || meetings[0]
      : meetings[0];

    setSelectedMeetingKey(defaultMeeting.meeting_key);
    const raceOrLatest =
      defaultMeeting.sessions.find((s) => s.session_type === "Race") ||
      defaultMeeting.sessions[0];
    if (raceOrLatest) {
      setSelectedSessionKey(raceOrLatest.session_key);
    }
  }, [meetings, initialCountry, selectedSessionKey]);

  const currentMeeting = useMemo(
    () =>
      meetings.find((m) => m.meeting_key === selectedMeetingKey) || meetings[0],
    [meetings, selectedMeetingKey]
  );

  // Fetch Timing Data
  const {
    data: timing,
    isLoading,
    isError,
    refetch,
  } = useQuery<TimingPayload>({
    queryKey: ["f1-timing", selectedSessionKey],
    enabled: Boolean(selectedSessionKey),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (selectedSessionKey) qs.set("session_key", String(selectedSessionKey));

      const res = await fetch(`/api/f1/timing?${qs.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat data timing");
      return res.json();
    },
    refetchInterval: (query) =>
      query.state.data?.mode === "LIVE" ? 4000 : false,
  });

  const activeLapNumber = replayLap ?? timing?.currentLap ?? 1;

  // In-Memory Replay Engine: Computes 60 FPS Tower instantly from lapsByDriver without network delays
  const activeTower = useMemo((): TimingTowerRow[] => {
    if (!timing) return [];
    if (replayLap === undefined || replayLap >= timing.totalLaps) {
      return timing.tower;
    }

    let overallFastestLapTime: number | null = null;
    let overallFastestDriverNumber: number | null = null;

    const personalBests = new Map<number, number>();
    for (const [dnStr, records] of Object.entries(timing.lapsByDriver || {})) {
      const dn = Number(dnStr);
      for (const r of records) {
        if (
          r.lapNumber <= activeLapNumber &&
          r.lapDuration &&
          r.lapDuration > 40
        ) {
          const pb = personalBests.get(dn);
          if (pb === undefined || r.lapDuration < pb) {
            personalBests.set(dn, r.lapDuration);
          }
          if (
            overallFastestLapTime === null ||
            r.lapDuration < overallFastestLapTime
          ) {
            overallFastestLapTime = r.lapDuration;
            overallFastestDriverNumber = dn;
          }
        }
      }
    }

    const towerRows: TimingTowerRow[] = [];

    for (const driver of timing.drivers) {
      const dn = driver.driverNumber;
      const originalTowerRow = timing.tower.find((t) => t.driverNumber === dn);
      const records = (timing.lapsByDriver[dn] || []).filter(
        (r) => r.lapNumber <= activeLapNumber
      );
      const latestRec = records[records.length - 1];
      const prevRec =
        records.length > 1 ? records[records.length - 2] : latestRec;

      const currentPos =
        latestRec?.position ?? originalTowerRow?.position ?? 20;
      const prevPos = prevRec?.position ?? currentPos;
      const posChange = prevPos - currentPos;

      const bestLap = personalBests.get(dn) ?? null;
      const lastLap = latestRec?.lapDuration ?? null;

      const isOverallFastest =
        bestLap !== null &&
        overallFastestDriverNumber === dn &&
        overallFastestLapTime !== null &&
        Math.abs(bestLap - overallFastestLapTime) < 0.001;

      const isPersonalBest =
        !isOverallFastest &&
        lastLap !== null &&
        bestLap !== null &&
        Math.abs(lastLap - bestLap) < 0.001;

      const pitStops = records.filter((r) => r.isPitLap).length;

      const gapSeconds = latestRec?.gapToLeader ?? 0;
      const intervalSeconds = latestRec?.intervalToAhead ?? 0;

      const gapDisplay =
        currentPos === 1
          ? "LEADER"
          : gapSeconds > 0
            ? `+${gapSeconds.toFixed(3)}s`
            : "-";
      const intervalDisplay =
        currentPos === 1
          ? "-"
          : intervalSeconds > 0
            ? `+${intervalSeconds.toFixed(3)}s`
            : "-";

      towerRows.push({
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
        sectors: originalTowerRow?.sectors ?? {
          s1: { time: null, color: "NONE" },
          s2: { time: null, color: "NONE" },
          s3: { time: null, color: "NONE" },
        },
        inPit: latestRec?.isPitLap ?? false,
        compound: latestRec?.compound ?? originalTowerRow?.compound ?? "MEDIUM",
        tyreAge: latestRec?.tyreAge ?? 1,
        pitStops,
        stints: originalTowerRow?.stints ?? [],
      });
    }

    towerRows.sort((a, b) => a.position - b.position);
    towerRows.forEach((row, idx) => {
      row.position = idx + 1;
      if (idx === 0) {
        row.gapToLeader = "LEADER";
        row.interval = "-";
      }
    });

    return towerRows;
  }, [timing, replayLap, activeLapNumber]);

  useEffect(() => {
    if (timing && focusedDriver === null && activeTower.length > 0) {
      setFocusedDriver(activeTower[0].driverNumber);
    }
  }, [timing, focusedDriver, activeTower]);

  // Replay playback ticker
  useEffect(() => {
    if (!isPlaying || !timing) return;
    const intervalMs = 1500 / playbackSpeed;
    const timer = setInterval(() => {
      setReplayLap((prev) => {
        const current = prev ?? timing.currentLap;
        if (current >= timing.totalLaps) {
          setIsPlaying(false);
          return timing.totalLaps;
        }
        return current + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, timing]);

  const maxGap = Math.max(
    1,
    ...(activeTower.map((r) => r.gapSeconds || 0) || [1])
  );

  const pitExitTargetDriverNumber = useMemo(() => {
    if (!timing || !focusedDriver) return null;
    const drv = activeTower.find((d) => d.driverNumber === focusedDriver);
    if (!drv) return null;
    const currentGap =
      drv.position === 1
        ? 0
        : drv.gapSeconds > 0
          ? drv.gapSeconds
          : (drv.position - 1) * 1.75;
    const projectedGap = currentGap + pitLossSeconds;

    let carDirectlyAhead: number | null = null;
    for (const row of activeTower) {
      if (row.driverNumber === focusedDriver) continue;
      const rGap =
        row.position === 1
          ? 0
          : row.gapSeconds > 0
            ? row.gapSeconds
            : (row.position - 1) * 1.75;
      if (rGap < projectedGap) {
        carDirectlyAhead = row.driverNumber;
      }
    }
    return carDirectlyAhead;
  }, [timing, activeTower, focusedDriver, pitLossSeconds]);

  const filteredRaceControl = useMemo(() => {
    const list = timing?.raceControl || [];
    return list.filter((rc) => {
      if (rc.lapNumber !== null && rc.lapNumber > activeLapNumber) return false;
      if (hideBlueFlags && rc.message.toUpperCase().includes("BLUE FLAG"))
        return false;
      return true;
    });
  }, [timing?.raceControl, activeLapNumber, hideBlueFlags]);

  return (
    <div className="space-y-6 pb-16">
      {/* ─── 1. HERO COMMAND BAR ─────────────────────────────────────────── */}
      <section
        aria-label="Informasi Sesi Balapan"
        className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Sesi & Status Hero */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {timing?.mode === "LIVE" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pitwall-red px-3 py-1 font-sans text-xs font-bold text-white shadow-xs">
                  <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                  LIVE TIMING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated border border-border-subtle px-3 py-1 text-xs font-semibold text-text-secondary">
                  <Radio className="h-3.5 w-3.5 text-amber-500" />
                  REPLAY TELEMETRY
                </span>
              )}

              {timing && <StatusPill status={timing.trackStatus} />}

              <span className="text-xs text-text-muted font-medium">
                {timing?.session.countryName} • Musim {timing?.session.year}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary">
              {timing?.session.circuitName || "Pilih Sirkuit"}{" "}
              <span className="text-pitwall-red">
                - {timing?.session.sessionName || "Race"}
              </span>
            </h1>

            {/* Weather Telemetry Pills */}
            {timing && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary pt-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-pitwall-red" />
                  Suhu Trek:{" "}
                  <strong className="font-mono text-text-primary tabular-nums">
                    {timing.weather.trackTemp.toFixed(1)}°C
                  </strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                  Suhu Udara:{" "}
                  <strong className="font-mono text-text-primary tabular-nums">
                    {timing.weather.airTemp.toFixed(1)}°C
                  </strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <CloudRain className="h-3.5 w-3.5 text-sky-400" />
                  Kelembaban:{" "}
                  <strong className="font-mono text-text-primary tabular-nums">
                    {timing.weather.humidity}%
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Lap Counter + Dropdowns */}
          <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-border-subtle lg:pl-6">
            {/* Lap Big Counter */}
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                Putaran Balap
              </span>
              <div className="font-mono text-3xl sm:text-4xl font-black tabular-nums text-text-primary">
                {activeLapNumber}
                <span className="text-base text-text-muted font-normal">
                  /{timing?.totalLaps ?? "--"}
                </span>
              </div>
            </div>

            {/* 3-Step Clean Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Season */}
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setSelectedMeetingKey(undefined);
                  setSelectedSessionKey(undefined);
                  setReplayLap(undefined);
                }}
                className="h-10 rounded-lg border border-border-subtle bg-surface-elevated px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
                aria-label="Pilih Musim"
              >
                {[2026, 2025, 2024, 2023].map((yr) => (
                  <option key={yr} value={yr}>
                    Musim {yr}
                  </option>
                ))}
              </select>

              {/* Circuit */}
              <select
                value={currentMeeting?.meeting_key || ""}
                onChange={(e) => {
                  const mKey = Number(e.target.value);
                  setSelectedMeetingKey(mKey);
                  const mObj = meetings.find((m) => m.meeting_key === mKey);
                  if (mObj) {
                    const defaultSes =
                      mObj.sessions.find((s) => s.session_type === "Race") ||
                      mObj.sessions[0];
                    setSelectedSessionKey(defaultSes?.session_key);
                    setReplayLap(undefined);
                    setIsPlaying(false);
                  }
                }}
                className="h-10 min-w-[150px] max-w-[220px] sm:max-w-xs truncate rounded-lg border border-border-subtle bg-surface-elevated px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
                aria-label="Pilih Sirkuit"
              >
                {meetings.length === 0 ? (
                  <option value="" disabled>
                    Memuat sirkuit...
                  </option>
                ) : (
                  meetings.map((m) => (
                    <option key={m.meeting_key} value={m.meeting_key}>
                      {m.country_name} ({m.circuit_short_name})
                    </option>
                  ))
                )}
              </select>

              {/* Session Type */}
              <select
                value={selectedSessionKey || ""}
                onChange={(e) => {
                  setSelectedSessionKey(Number(e.target.value));
                  setReplayLap(undefined);
                  setIsPlaying(false);
                }}
                className="h-10 min-w-[120px] rounded-lg border border-border-subtle bg-surface-elevated px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
                aria-label="Pilih Tipe Sesi"
              >
                {(currentMeeting?.sessions || []).length === 0 ? (
                  <option value="" disabled>
                    Memuat sesi...
                  </option>
                ) : (
                  (currentMeeting?.sessions || []).map((s) => (
                    <option key={s.session_key} value={s.session_key}>
                      {s.session_name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. REPLAY TIMELINE SCRUBBER ─────────────────────────────────── */}
      {timing && (
        <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (activeLapNumber >= timing.totalLaps) setReplayLap(1);
                setIsPlaying((p) => !p);
              }}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Jeda Replay</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Putar Replay</span>
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsPlaying(false);
                setReplayLap(1);
              }}
              title="Kembali ke Lap 1"
            >
              <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
              <span>Lap 01</span>
            </Button>

            {/* Speed Selector */}
            <div className="inline-flex rounded-md border border-border-subtle bg-surface-elevated p-0.5">
              {([1, 2, 4] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                    playbackSpeed === spd
                      ? "bg-surface text-text-primary shadow-xs"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {spd}X
                </button>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div className="flex flex-1 items-center gap-3 sm:max-w-xl">
            <span className="font-mono text-xs text-text-muted">L01</span>
            <input
              type="range"
              min={1}
              max={timing.totalLaps}
              value={activeLapNumber}
              onChange={(e) => {
                setIsPlaying(false);
                setReplayLap(Number(e.target.value));
              }}
              aria-label="Scrubber Lap"
            />
            <span className="font-mono text-xs font-bold tabular-nums text-text-primary whitespace-nowrap">
              Lap {String(activeLapNumber).padStart(2, "0")}/
              {String(timing.totalLaps).padStart(2, "0")}
            </span>
          </div>

          <Link
            href={`/analysis?session_key=${timing.session.sessionKey}&year=${timing.session.year}`}
          >
            <Button variant="ghost" size="sm">
              <LineChart className="h-4 w-4 text-text-muted" />
              <span>Grafik Telemetri →</span>
            </Button>
          </Link>
        </div>
      )}

      {/* ─── 3. LOADING & ERROR STATES ───────────────────────────────────── */}
      {isLoading && (
        <div className="p-16 text-center">
          <EmptyState
            title="Menyinkronkan Feed Live Timing"
            description="Mengunduh data telemetri dan klasifikasi balapan dari OpenF1..."
          />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Gagal Mengambil Data Timing"
          description="Terjadi kendala saat memuat feed timing OpenF1. Silakan coba sesi lain atau muat ulang."
          actionLabel="Muat Ulang"
          onAction={() => refetch()}
        />
      )}

      {/* ─── 4. MAIN TIMING TABLE & RADAR SIDE PANEL ──────────────────────── */}
      {timing && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: TIMING CLASSIFICATION TABLE */}
          <div className="lg:col-span-7">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface-elevated/40 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pitwall-red" />
                  <span className="font-display text-base font-bold text-text-primary tracking-tight">
                    Klasifikasi Balapan
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  Klik baris pembalap untuk simulasi Pit Window
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-elevated/20 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <th className="py-3 px-3 w-12 text-center sticky left-0 bg-surface z-10 shadow-xs">
                        Pos
                      </th>
                      <th className="py-3 px-3 min-w-[150px] sticky left-12 bg-surface z-10 shadow-xs">
                        Pembalap
                      </th>
                      <th className="py-3 px-3 text-right">Interval</th>
                      <th className="py-3 px-3 text-right">Gap P1</th>
                      <th className="py-3 px-3 text-right">Lap Terakhir</th>
                      <th className="py-3 px-3 text-center">Sektor</th>
                      <th className="py-3 px-3 text-right">Best Lap</th>
                      <th className="py-3 px-3 text-center">Ban</th>
                      <th className="py-3 pr-4 pl-2 text-center">Pit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {activeTower.map((row) => {
                      const isFocused = focusedDriver === row.driverNumber;
                      const isPitExitSlot =
                        pitExitTargetDriverNumber === row.driverNumber;
                      const gapPct = Math.min(
                        100,
                        ((row.gapSeconds || 0) / maxGap) * 100
                      );

                      return (
                        <React.Fragment key={row.driverNumber}>
                          <tr
                            onClick={() =>
                              setFocusedDriver(
                                isFocused ? null : row.driverNumber
                              )
                            }
                            className={`group cursor-pointer transition-colors ${
                              isFocused
                                ? "bg-pitwall-red/10 hover:bg-pitwall-red/15"
                                : "hover:bg-surface-hover/70"
                            }`}
                          >
                            {/* Posisi (Sticky Mobile) */}
                            <td className="py-3.5 px-3 text-center font-mono font-bold tabular-nums sticky left-0 bg-inherit z-10">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-text-primary text-xs">
                                  {String(row.position).padStart(2, "0")}
                                </span>
                                {row.positionChange > 0 && (
                                  <span className="text-[10px] text-emerald-500 font-bold">
                                    ▲{row.positionChange}
                                  </span>
                                )}
                                {row.positionChange < 0 && (
                                  <span className="text-[10px] text-red-500 font-bold">
                                    ▼{Math.abs(row.positionChange)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Driver (Sticky Mobile) */}
                            <td className="py-3.5 px-3 sticky left-12 bg-inherit z-10">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <TeamStripe color={row.teamColor} size="md" />
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-bold text-text-primary">
                                        {row.code}
                                      </span>
                                      <span className="font-semibold text-text-primary text-xs hidden sm:inline">
                                        {row.fullName}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-text-muted truncate">
                                      {row.teamName}
                                    </span>
                                  </div>
                                </div>

                                <Link
                                  href={`/drivers/${row.code.toLowerCase()}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
                                  title={`Buka Profil ${row.fullName}`}
                                >
                                  Bio↗
                                </Link>
                              </div>
                            </td>

                            {/* Interval */}
                            <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-text-secondary font-medium">
                              {row.interval}
                            </td>

                            {/* Gap to Leader with neutral bar */}
                            <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-text-secondary font-medium">
                              <div>{row.gapToLeader}</div>
                              {row.position > 1 && (
                                <div className="mt-1 h-1 w-full rounded-full bg-border-subtle overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-text-primary/30"
                                    style={{ width: `${gapPct}%` }}
                                  />
                                </div>
                              )}
                            </td>

                            {/* Last Lap */}
                            <td
                              className={`py-3.5 px-3 text-right font-mono text-xs tabular-nums font-semibold ${
                                row.isOverallFastest
                                  ? "text-purple-500 font-bold"
                                  : row.isPersonalBest
                                    ? "text-emerald-500 font-bold"
                                    : "text-text-primary"
                              }`}
                            >
                              {formatLapTime(row.lastLap)}
                            </td>

                            {/* Mini Sectors */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {(["s1", "s2", "s3"] as const).map((secKey) => {
                                  const sec = row.sectors?.[secKey];
                                  const barColor =
                                    SECTOR_COLOR_BAR[sec?.color || "NONE"];
                                  return (
                                    <div
                                      key={secKey}
                                      title={
                                        sec?.time
                                          ? `${secKey.toUpperCase()}: ${sec.time.toFixed(
                                              3
                                            )}s`
                                          : secKey.toUpperCase()
                                      }
                                      className={`h-2.5 w-3.5 rounded-xs ${barColor}`}
                                    />
                                  );
                                })}
                              </div>
                            </td>

                            {/* Best Lap */}
                            <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-text-secondary">
                              <span
                                className={
                                  row.isOverallFastest
                                    ? "rounded bg-purple-500/10 px-1 py-0.5 font-bold text-purple-600 dark:text-purple-400"
                                    : ""
                                }
                              >
                                {formatLapTime(row.bestLap)}
                              </span>
                            </td>

                            {/* Tyre Icon */}
                            <td className="py-3.5 px-3 text-center">
                              <TyreIcon
                                compound={row.compound}
                                age={row.tyreAge}
                                size="sm"
                              />
                            </td>

                            {/* Pit count */}
                            <td className="py-3.5 pr-4 pl-2 text-center font-mono text-xs tabular-nums text-text-muted">
                              {row.pitStops}
                            </td>
                          </tr>

                          {/* Pit Window Exit Prediction Banner */}
                          {isPitExitSlot && focusedDriver && (
                            <tr className="bg-amber-500/10">
                              <td
                                colSpan={9}
                                className="border-y border-dashed border-amber-500/50 px-4 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 font-sans"
                              >
                                ↳ [Estimasi Pit Exit]{" "}
                                {
                                  activeTower.find(
                                    (d) => d.driverNumber === focusedDriver
                                  )?.fullName
                                }{" "}
                                akan keluar di slot ini (+{pitLossSeconds}s Pit Loss)
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* RIGHT: CIRCUIT RADAR & RACE CONTROL SIDE PANEL */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            {/* Track Map Radar */}
            <TrackMap
              sessionKey={timing.session.sessionKey}
              circuitName={timing.session.circuitName}
              tower={activeTower}
              trackStatus={timing.trackStatus}
              selectedDriver={focusedDriver}
              onSelectDriver={setFocusedDriver}
              isLiveOrPlaying={timing.mode === "LIVE" || isPlaying}
              pitLossSeconds={pitLossSeconds}
              onChangePitLoss={setPitLossSeconds}
            />

            {/* Race Control Panel */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-subtle bg-surface-elevated/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-pitwall-red" />
                  <span className="font-display text-base font-bold text-text-primary tracking-tight">
                    Pesan Race Control
                  </span>
                </div>

                <button
                  onClick={() => setHideBlueFlags((p) => !p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors border ${
                    hideBlueFlags
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border-subtle bg-surface text-text-secondary"
                  }`}
                >
                  {hideBlueFlags ? "Blue Flag Disembunyikan" : "Semua Bendera"}
                </button>
              </div>

              <div className="max-h-64 divide-y divide-border-subtle overflow-y-auto text-xs">
                {filteredRaceControl.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    Tidak ada insiden atau bendera aktif saat ini.
                  </div>
                ) : (
                  filteredRaceControl.map((rc) => {
                    const msgUp = rc.message.toUpperCase();
                    const isAlert =
                      msgUp.includes("PENALTY") ||
                      msgUp.includes("INVESTIGATION") ||
                      msgUp.includes("RED");
                    const isCaution =
                      msgUp.includes("YELLOW") || msgUp.includes("SAFETY CAR");

                    return (
                      <div
                        key={rc.id}
                        className={`p-3.5 transition-colors ${
                          isAlert
                            ? "border-l-4 border-l-red-500 bg-red-500/5"
                            : isCaution
                              ? "border-l-4 border-l-amber-400 bg-amber-500/5"
                              : ""
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span className="font-bold">
                            {rc.lapNumber ? `Lap ${rc.lapNumber}` : "Steward"}
                          </span>
                          <span className="font-mono tabular-nums">
                            {new Date(rc.timestamp).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="mt-1 font-semibold text-text-primary">
                          {rc.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveTimingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-16 text-center">
          <EmptyState
            title="Memuat Live Timing"
            description="Menyiapkan data telemetri Formula 1..."
          />
        </div>
      }
    >
      <LiveTimingContent />
    </React.Suspense>
  );
}
