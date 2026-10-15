"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { TimingPayload, TyreCompound } from "@/lib/f1/schemas";
import { formatLapTime } from "@/lib/f1";
import { useUI } from "@/components/providers";
import {
  LineChart as LineChartIcon,
  TrendingDown,
  Activity,
  Layers,
  RotateCcw,
  Sliders,
  AlertCircle,
  Clock,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TeamStripe } from "@/components/ui/team-stripe";
import { TyreIcon } from "@/components/ui/tyre-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonChart } from "@/components/ui/skeleton";

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

interface SessionsResponse {
  requestedYear: number;
  resolvedYear: number;
  sessions: SessionItem[];
  meetings: MeetingGroup[];
}

type AnalysisTab = "gap" | "laptimes" | "positions" | "tyres";

const COMPOUND_COLORS: Record<TyreCompound, { bg: string; text: string; border: string }> = {
  SOFT: { bg: "bg-red-500", text: "text-white", border: "border-red-600" },
  MEDIUM: { bg: "bg-amber-400", text: "text-black", border: "border-amber-500" },
  HARD: { bg: "bg-slate-200 dark:bg-slate-100", text: "text-black", border: "border-slate-300" },
  INTERMEDIATE: { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-600" },
  WET: { bg: "bg-blue-500", text: "text-white", border: "border-blue-600" },
  UNKNOWN: { bg: "bg-zinc-600", text: "text-white", border: "border-zinc-500" },
};

function AnalysisContent() {
  const { locale, t } = useUI();
  const searchParams = useSearchParams();

  const paramSessionKey =
    searchParams.get("session_key") || searchParams.get("sessionKey");
  const paramYear = searchParams.get("year") || searchParams.get("season");
  const paramCountry = searchParams.get("country");

  const initialYear = paramYear ? Number(paramYear) : new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<number | undefined>(undefined);
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | undefined>(
    paramSessionKey ? Number(paramSessionKey) : undefined
  );

  // Selected drivers for telemetry overlay (2-5 drivers)
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);

  // Active chart tab (defaults to Gap to Leader as requested)
  const [activeTab, setActiveTab] = useState<AnalysisTab>("gap");

  // Fetch available meetings & sessions
  const { data: sessionsPayload, isLoading: isLoadingSessions } =
    useQuery<SessionsResponse>({
      queryKey: ["analysisSessionsList", selectedYear],
      queryFn: async () => {
        const res = await fetch(`/api/f1/sessions?year=${selectedYear}`);
        if (!res.ok) {
          return {
            requestedYear: selectedYear,
            resolvedYear: selectedYear,
            sessions: [],
            meetings: [],
          };
        }
        return res.json();
      },
    });

  const meetings = useMemo(
    () => sessionsPayload?.meetings || [],
    [sessionsPayload]
  );

  // Sync selected meeting & session
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

    const defaultMeeting = paramCountry
      ? meetings.find((m) =>
          m.country_name.toLowerCase().includes(paramCountry.toLowerCase())
        ) || meetings[0]
      : meetings[0];

    setSelectedMeetingKey(defaultMeeting.meeting_key);
    const raceOrLatest =
      defaultMeeting.sessions.find((s) => s.session_type === "Race") ||
      defaultMeeting.sessions[0];
    if (raceOrLatest) {
      setSelectedSessionKey(raceOrLatest.session_key);
    }
  }, [meetings, paramCountry, selectedSessionKey]);

  const currentMeeting = useMemo(
    () =>
      meetings.find((m) => m.meeting_key === selectedMeetingKey) || meetings[0],
    [meetings, selectedMeetingKey]
  );

  // Fetch Timing Telemetry
  const {
    data: timing,
    isLoading: isLoadingTiming,
    isError,
    refetch,
  } = useQuery<TimingPayload>({
    queryKey: ["analysisTiming", selectedSessionKey, selectedYear],
    enabled: Boolean(selectedSessionKey),
    queryFn: async () => {
      const q = new URLSearchParams();
      if (selectedSessionKey) q.set("session_key", String(selectedSessionKey));
      if (selectedYear) q.set("year", String(selectedYear));

      const res = await fetch(`/api/f1/timing?${q.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat data telemetri");
      return res.json();
    },
  });

  // Re-initialize drivers on session change
  useEffect(() => {
    if (!timing?.tower || timing.tower.length === 0) return;
    const availableNumbers = new Set(timing.tower.map((d) => d.driverNumber));
    setSelectedDrivers((prev) => {
      const validSelected = prev.filter((n) => availableNumbers.has(n));
      if (validSelected.length === 0) {
        return timing.tower.slice(0, 4).map((d) => d.driverNumber);
      }
      return validSelected;
    });
  }, [timing]);

  const toggleDriver = (dn: number) => {
    setSelectedDrivers((prev) =>
      prev.includes(dn) ? prev.filter((d) => d !== dn) : [...prev, dn]
    );
  };

  const selectTop3 = () => {
    if (timing?.tower) {
      setSelectedDrivers(timing.tower.slice(0, 3).map((d) => d.driverNumber));
    }
  };

  const selectTop5 = () => {
    if (timing?.tower) {
      setSelectedDrivers(timing.tower.slice(0, 5).map((d) => d.driverNumber));
    }
  };

  const resetSelection = () => {
    if (timing?.tower) {
      setSelectedDrivers(timing.tower.slice(0, 4).map((d) => d.driverNumber));
    }
  };

  // Build unified chart datasets
  const chartData = useMemo(() => {
    if (!timing?.lapsByDriver || !timing.totalLaps) return [];

    const totalLaps = timing.totalLaps;
    const result: any[] = [];

    for (let lap = 1; lap <= totalLaps; lap++) {
      const lapObj: any = { lap };

      for (const dn of selectedDrivers) {
        const records = timing.lapsByDriver[dn] || [];
        const record = records.find((r) => r.lapNumber === lap);

        if (record) {
          const dur =
            record.lapDuration && record.lapDuration > 0 && record.lapDuration < 200
              ? record.lapDuration
              : null;
          lapObj[`lap_${dn}`] = dur;
          lapObj[`gap_${dn}`] = record.gapToLeader;
          lapObj[`pos_${dn}`] = record.position;
        }
      }
      result.push(lapObj);
    }
    return result;
  }, [timing, selectedDrivers]);

  // Driver metadata lookup
  const driverMeta = useMemo(() => {
    const map = new Map<
      number,
      { code: string; name: string; color: string; team: string }
    >();
    if (timing?.drivers) {
      for (const d of timing.drivers) {
        map.set(d.driverNumber, {
          code: d.code,
          name: d.fullName,
          color: d.teamColor,
          team: d.teamName,
        });
      }
    }
    return map;
  }, [timing]);

  const hasTelemetryData = Boolean(timing && timing.totalLaps > 0);

  return (
    <div className="space-y-6 pb-16">
      {/* ─── 1. HEADER & SESSIONS SELECTOR ───────────────────────────────── */}
      <section
        aria-label="Pemilih Sesi Telemetri"
        className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pitwall-red" />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Analisis Telemetri Lap & Ban
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-text-primary">
              {timing?.session.circuitName || currentMeeting?.circuit_short_name || "Pilih Sirkuit"}{" "}
              <span className="text-pitwall-red">
                - {timing?.session.sessionName || "Sesi Balap"}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary font-medium">
              Perbandingan lap-by-lap gap pemimpin, konsistensi waktu lap, dan strategi pit stop
            </p>
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
                setSelectedDrivers([]);
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

            {/* Circuit / Meeting */}
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
                  setSelectedDrivers([]);
                }
              }}
              className="h-10 min-w-[150px] max-w-[220px] sm:max-w-xs truncate rounded-lg border border-border-subtle bg-surface-elevated px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
              aria-label="Pilih Grand Prix"
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
                setSelectedDrivers([]);
              }}
              className="h-10 min-w-[120px] rounded-lg border border-border-subtle bg-surface-elevated px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
              aria-label="Pilih Sesi"
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
      </section>

      {/* ─── 2. DRIVER COMPARISON CHIPS ──────────────────────────────────── */}
      {timing && timing.tower && timing.tower.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border-subtle">
            <div>
              <span className="text-xs font-bold text-text-primary">
                Pilih Pembalap untuk Komparasi (Maks 5 Rekomendasi)
              </span>
              <span className="text-xs text-text-muted ml-2">
                • {selectedDrivers.length} pembalap aktif
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={selectTop3}>
                Top 3
              </Button>
              <Button variant="ghost" size="sm" onClick={selectTop5}>
                Top 5
              </Button>
              <Button variant="ghost" size="sm" onClick={resetSelection}>
                Reset
              </Button>
            </div>
          </div>

          {/* Chips grid */}
          <div className="flex flex-wrap gap-2 pt-3">
            {timing.tower.map((row) => {
              const isSelected = selectedDrivers.includes(row.driverNumber);
              return (
                <button
                  key={row.driverNumber}
                  onClick={() => toggleDriver(row.driverNumber)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "border-text-primary bg-surface-elevated text-text-primary shadow-xs font-bold"
                      : "border-border-subtle bg-surface text-text-muted hover:border-border-strong hover:text-text-primary"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: row.teamColor }}
                  />
                  <span>{row.code}</span>
                  <span className="text-[10px] text-text-muted font-mono font-normal">
                    P{row.position}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ─── 3. LOADING / ERROR / EMPTY STATES ───────────────────────────── */}
      {isLoadingTiming && <SkeletonChart />}

      {isError && (
        <EmptyState
          icon={AlertCircle}
          title="Gagal Mengambil Data Telemetri"
          description="Terjadi kesalahan jaringan saat mengambil telemetri sesi ini. Silakan coba sesi lain atau muat ulang."
          actionLabel="Muat Ulang"
          onAction={() => refetch()}
        />
      )}

      {!isLoadingTiming && !isError && !hasTelemetryData && (
        <EmptyState
          icon={LineChartIcon}
          title="Belum Ada Data Telemetri Sesi Ini"
          description="Sesi yang Anda pilih belum berlangsung atau tidak memiliki rekaman telemetri lap. Silakan pilih sesi balapan yang telah selesai."
          actionLabel="Pilih Musim 2024 (Data Lengkap)"
          onAction={() => setSelectedYear(2024)}
        />
      )}

      {/* ─── 4. MAIN TELEMETRY CHARTS ────────────────────────────────────── */}
      {!isLoadingTiming && !isError && hasTelemetryData && (
        <Card className="overflow-hidden">
          {/* Chart Header + Segmented Tabs */}
          <div className="flex flex-col gap-4 border-b border-border-subtle bg-surface-elevated/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                {activeTab === "gap" && "Gap Waktu ke Pemimpin Balap (Detik)"}
                {activeTab === "laptimes" && "Konsistensi Catatan Waktu Lap (Detik)"}
                {activeTab === "positions" && "Perubahan Posisi per Putaran"}
                {activeTab === "tyres" && "Matriks Strategi Kompon Ban & Stint"}
              </CardTitle>
              <p className="text-xs text-text-muted mt-0.5">
                {activeTab === "gap" && "Semakin landai kurva, semakin dekat jarak mobil dengan pemenang balap"}
                {activeTab === "laptimes" && "Waktu lap lebih rendah menunjukkan kecepatan lebih tinggi"}
                {activeTab === "positions" && "Posisi P1 berada di bagian atas grafik"}
                {activeTab === "tyres" && "Distribusi jumlah putaran per kompon ban yang digunakan tiap pembalap"}
              </p>
            </div>

            <SegmentedControl<AnalysisTab>
              value={activeTab}
              onChange={setActiveTab}
              size="sm"
              options={[
                { value: "gap", label: "Gap Pemimpin" },
                { value: "laptimes", label: "Waktu Lap" },
                { value: "positions", label: "Posisi" },
                { value: "tyres", label: "Strategi Ban" },
              ]}
            />
          </div>

          <CardContent className="p-6">
            {/* TAB 1: GAP TO LEADER */}
            {activeTab === "gap" && (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-subtle)"
                    />
                    <XAxis
                      dataKey="lap"
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                      label={{
                        value: "Putaran (Lap)",
                        position: "insideBottom",
                        offset: -12,
                        fill: "var(--color-text-muted)",
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                      unit="s"
                      label={{
                        value: "Gap ke P1 (Detik)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "var(--color-text-muted)",
                        fontSize: 12,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border-strong)",
                        borderRadius: "10px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any) => {
                        const dn = Number(String(name).replace("gap_", ""));
                        const meta = driverMeta.get(dn);
                        const label = meta ? `${meta.code} (${meta.name})` : name;
                        if (val === null || val === undefined) return ["-", label];
                        if (val === 0) return ["LEADER", label];
                        return [`+${Number(val).toFixed(3)}s`, label];
                      }}
                      labelFormatter={(label) => `Lap ${label}`}
                      isAnimationActive={false}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => {
                        const dn = Number(String(value).replace("gap_", ""));
                        const meta = driverMeta.get(dn);
                        return meta?.code || value;
                      }}
                    />

                    {/* Subtle Safety Car period shading */}
                    {timing?.scPeriods?.map((sc, i) => (
                      <ReferenceArea
                        key={i}
                        x1={sc.startLap}
                        x2={sc.endLap}
                        fill="rgba(245, 158, 11, 0.08)"
                        stroke="rgba(245, 158, 11, 0.3)"
                        strokeDasharray="3 3"
                        label={{
                          value: sc.type,
                          fill: "var(--color-text-muted)",
                          fontSize: 10,
                          position: "top",
                        }}
                      />
                    ))}

                    {selectedDrivers.map((dn) => {
                      const meta = driverMeta.get(dn);
                      return (
                        <Line
                          key={dn}
                          type="monotone"
                          dataKey={`gap_${dn}`}
                          stroke={meta?.color || "#E10600"}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* TAB 2: LAP TIMES */}
            {activeTab === "laptimes" && (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-subtle)"
                    />
                    <XAxis
                      dataKey="lap"
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                      label={{
                        value: "Putaran (Lap)",
                        position: "insideBottom",
                        offset: -12,
                        fill: "var(--color-text-muted)",
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                      domain={["dataMin - 1", "dataMax + 2"]}
                      tickFormatter={(val) => formatLapTime(val)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border-strong)",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any) => {
                        const dn = Number(String(name).replace("lap_", ""));
                        const meta = driverMeta.get(dn);
                        const label = meta ? `${meta.code} (${meta.name})` : name;
                        return [formatLapTime(val), label];
                      }}
                      labelFormatter={(label) => `Lap ${label}`}
                      isAnimationActive={false}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => {
                        const dn = Number(String(value).replace("lap_", ""));
                        const meta = driverMeta.get(dn);
                        return meta?.code || value;
                      }}
                    />

                    {selectedDrivers.map((dn) => {
                      const meta = driverMeta.get(dn);
                      return (
                        <Line
                          key={dn}
                          type="monotone"
                          dataKey={`lap_${dn}`}
                          stroke={meta?.color || "#E10600"}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* TAB 3: POSITION PROGRESSION */}
            {activeTab === "positions" && (
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-subtle)"
                    />
                    <XAxis
                      dataKey="lap"
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                    />
                    <YAxis
                      reversed
                      domain={[1, 20]}
                      ticks={[1, 5, 10, 15, 20]}
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                      tickFormatter={(val) => `P${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border-strong)",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: any) => {
                        const dn = Number(String(name).replace("pos_", ""));
                        const meta = driverMeta.get(dn);
                        const label = meta ? `${meta.code}` : name;
                        return [`P${val}`, label];
                      }}
                      labelFormatter={(label) => `Lap ${label}`}
                      isAnimationActive={false}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => {
                        const dn = Number(String(value).replace("pos_", ""));
                        const meta = driverMeta.get(dn);
                        return meta?.code || value;
                      }}
                    />

                    {selectedDrivers.map((dn) => {
                      const meta = driverMeta.get(dn);
                      return (
                        <Line
                          key={dn}
                          type="stepAfter"
                          dataKey={`pos_${dn}`}
                          stroke={meta?.color || "#E10600"}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* TAB 4: TYRE STINT STRATEGY (HORIZONTAL BARS) */}
            {activeTab === "tyres" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-text-muted pb-2 border-b border-border-subtle">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500" /> Soft (S)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-amber-400" /> Medium (M)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-slate-200 border border-slate-300" /> Hard (H)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" /> Inter (I)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-blue-500" /> Wet (W)
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {timing?.tower.map((row) => {
                    const totalLaps = timing.totalLaps || 60;
                    return (
                      <div
                        key={row.driverNumber}
                        className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4"
                      >
                        {/* Driver info */}
                        <div className="flex items-center gap-2 w-32 shrink-0">
                          <TeamStripe color={row.teamColor} size="sm" />
                          <span className="font-mono text-xs font-bold text-text-primary">
                            {row.code}
                          </span>
                          <span className="text-[11px] text-text-muted font-mono">
                            P{row.position}
                          </span>
                        </div>

                        {/* Stint bars */}
                        <div className="flex-1 flex h-7 rounded-lg bg-surface-elevated overflow-hidden p-0.5 gap-0.5">
                          {row.stints.map((stint, i) => {
                            const stintLaps = Math.max(
                              1,
                              stint.lapEnd - stint.lapStart + 1
                            );
                            const widthPct = (stintLaps / totalLaps) * 100;
                            const compoundStyle =
                              COMPOUND_COLORS[stint.compound] ||
                              COMPOUND_COLORS.UNKNOWN;

                            return (
                              <div
                                key={i}
                                style={{ width: `${widthPct}%` }}
                                className={`h-full rounded-md flex items-center justify-center text-[10px] font-black font-mono shadow-xs truncate px-1 ${compoundStyle.bg} ${compoundStyle.text}`}
                                title={`${stint.compound}: Lap ${stint.lapStart} - ${stint.lapEnd} (${stintLaps} lap)`}
                              >
                                <span>
                                  {stint.compound[0]} ({stintLaps}L)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <React.Suspense fallback={<SkeletonChart />}>
      <AnalysisContent />
    </React.Suspense>
  );
}
