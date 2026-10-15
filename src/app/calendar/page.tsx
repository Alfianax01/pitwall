"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarEvent,
  SessionScheduleItem,
} from "@/lib/f1/schemas";
import { downloadIcsFile } from "@/lib/f1/ics";
import { useUI } from "@/components/providers";
import {
  Calendar as CalendarIcon,
  Download,
  MapPin,
  ChevronRight,
  ChevronDown,
  Trophy,
  Activity,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CountdownBlock } from "@/components/ui/countdown-block";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

// Format helper for dates
function formatWeekendSpan(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function formatSessionTime(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}

function formatWithOffset(utcIso: string, offsetStr: string = "+00:00"): string {
  try {
    if (!offsetStr || typeof offsetStr !== "string") return "-";
    const d = new Date(utcIso);
    if (isNaN(d.getTime())) return "-";
    const sign = offsetStr.startsWith("-") ? -1 : 1;
    const parts = offsetStr.replace(/[+-]/, "").split(":");
    const hours = parseInt(parts[0] || "0", 10);
    const mins = parseInt(parts[1] || "0", 10);
    const totalOffsetMs = sign * (hours * 60 + mins) * 60 * 1000;
    const target = new Date(d.getTime() + totalOffsetMs);
    return target.toISOString().slice(11, 16);
  } catch {
    return "-";
  }
}

type FilterKey = "ALL" | "UPCOMING" | "COMPLETED" | "SPRINT";

export default function CalendarPage() {
  const { locale, t } = useUI();
  const currentYear = new Date().getFullYear();
  const [season, setSeason] = useState<number>(currentYear);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [userTz, setUserTz] = useState<string>("Asia/Jakarta");
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setUserTz(detected);
    } catch {
      // fallback
    }
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleExpand = (round: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedRounds((prev) => ({ ...prev, [round]: !prev[round] }));
  };

  // Fetch season calendar
  const {
    data: calendar,
    isLoading,
    isError,
    refetch,
  } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar", season],
    queryFn: async () => {
      const res = await fetch(`/api/f1/calendar?year=${season}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.events || [];
    },
  });

  const events = useMemo(() => calendar || [], [calendar]);

  // Find next race (or first upcoming)
  const nextEvent = useMemo(() => {
    return (
      events.find((e) => e.status === "NEXT") ||
      events.find((e) => e.status === "UPCOMING") ||
      events[events.length - 1] ||
      null
    );
  }, [events]);

  const nextSession = useMemo(() => {
    if (!nextEvent) return null;
    return (
      nextEvent.sessions.find((s) => new Date(s.utcIso).getTime() > nowMs) ||
      nextEvent.sessions[nextEvent.sessions.length - 1]
    );
  }, [nextEvent, nowMs]);

  const countdown = useMemo(() => {
    if (!nextSession) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = Math.max(0, new Date(nextSession.utcIso).getTime() - nowMs);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
  }, [nextSession, nowMs]);

  // Filtered list
  const filteredEvents = useMemo(() => {
    if (filter === "ALL") return events;
    if (filter === "SPRINT") {
      return events.filter((e) =>
        e.sessions.some((s) => s.key === "SPRINT" || s.key === "SPRINT_QUALI")
      );
    }
    if (filter === "UPCOMING") {
      return events.filter((e) => e.status === "UPCOMING" || e.status === "NEXT");
    }
    return events.filter((e) => e.status === "COMPLETED");
  }, [events, filter]);

  const handleExportAll = () => {
    if (events.length > 0) {
      downloadIcsFile(`F1-Musim-${season}-Kalender.ics`, events);
    }
  };

  const handleExportSingle = (ev: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    downloadIcsFile(`F1-${ev.season}-R${ev.round}-${ev.raceName}.ics`, [ev]);
  };

  // Does the race timezone differ from WIB?
  const isDifferentFromWib = (offset: string) => {
    return offset !== "+07:00" && offset !== "+07";
  };

  return (
    <div className="space-y-8 pb-12">
      {/* ─── 1. HERO: BALAPAN BERIKUTNYA ─────────────────────────────────── */}
      {nextEvent && (
        <section
          aria-label="Balapan Berikutnya"
          className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-surface via-surface to-surface-elevated p-6 sm:p-8 lg:p-10 shadow-sm"
        >
          {/* Subtle background red flare */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-pitwall-red/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Race Information */}
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  status={nextEvent.status}
                  label={
                    nextEvent.status === "NEXT"
                      ? "Balapan Berikutnya"
                      : nextEvent.status === "COMPLETED"
                        ? "Selesai"
                        : "Akan Datang"
                  }
                  pulse={nextEvent.status === "NEXT"}
                />
                <span className="text-xs font-semibold text-text-muted">
                  Ronde {String(nextEvent.round).padStart(2, "0")} dari {events.length || 24}
                </span>
                {nextEvent.sessions.some((s) => s.key === "SPRINT") && (
                  <Badge variant="sprint" size="sm">
                    <Flame className="h-3 w-3" /> Sprint Weekend
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-text-primary">
                  <span className="mr-2 text-3xl sm:text-4xl lg:text-5xl inline-block">
                    {nextEvent.countryFlag}
                  </span>
                  {nextEvent.raceName}
                </h1>
                <p className="mt-2 flex items-center gap-1.5 text-sm sm:text-base text-text-secondary font-medium">
                  <MapPin className="h-4 w-4 text-pitwall-red shrink-0" />
                  <span>{nextEvent.circuitName}</span>
                  <span className="text-text-muted">•</span>
                  <span>
                    {nextEvent.locality}, {nextEvent.country}
                  </span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={`/live?year=${nextEvent.season}&country=${encodeURIComponent(
                    nextEvent.country
                  )}`}
                >
                  <Button variant="primary" size="md">
                    <Activity className="h-4 w-4" />
                    <span>Buka Live Timing</span>
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={(e) => handleExportSingle(nextEvent, e)}
                >
                  <Download className="h-4 w-4 text-text-muted" />
                  <span>Tambah ke Kalender (.ics)</span>
                </Button>
                <Link href={`/calendar/${nextEvent.round}?year=${nextEvent.season}`}>
                  <Button variant="ghost" size="md">
                    <span>Detail Balapan</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Countdown & Schedule Preview */}
            <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-elevated/60 p-5 sm:p-6 lg:min-w-[380px]">
              {nextSession && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-text-muted mb-3">
                    <span className="uppercase tracking-wider">
                      Hitung Mundur Sesi:{" "}
                      <strong className="text-text-primary font-bold">
                        {nextSession.label}
                      </strong>
                    </span>
                  </div>
                  <CountdownBlock
                    days={countdown.days}
                    hours={countdown.hours}
                    minutes={countdown.minutes}
                    seconds={countdown.seconds}
                  />
                </div>
              )}

              {/* Sessions mini timeline in WIB */}
              <div className="border-t border-border-subtle pt-3">
                <span className="text-xs font-semibold text-text-muted block mb-2">
                  Jadwal Waktu Indonesia Barat (WIB)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {nextEvent.sessions.map((ses) => (
                    <div
                      key={ses.key}
                      className="flex items-center justify-between rounded-md bg-surface px-2.5 py-1.5 border border-border-subtle/50"
                    >
                      <span className="font-semibold text-text-secondary truncate">
                        {ses.label}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-text-primary ml-2">
                        {formatSessionTime(ses.utcIso, "Asia/Jakarta")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── 2. TOOLBAR: FILTER & SEASON SELECTOR ───────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Jadwal Grand Prix {season}
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary">
            Zona waktu Anda: <span className="font-semibold text-text-primary">{userTz}</span> • Waktu tayang terkonversi otomatis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Filter */}
          <SegmentedControl<FilterKey>
            value={filter}
            onChange={setFilter}
            size="sm"
            options={[
              { value: "ALL", label: "Semua", badge: events.length },
              {
                value: "UPCOMING",
                label: "Akan Datang",
                badge: events.filter((e) => e.status !== "COMPLETED").length,
              },
              {
                value: "COMPLETED",
                label: "Selesai",
                badge: events.filter((e) => e.status === "COMPLETED").length,
              },
              {
                value: "SPRINT",
                label: "Sprint",
                badge: events.filter((e) =>
                  e.sessions.some((s) => s.key === "SPRINT")
                ).length,
              },
            ]}
          />

          {/* Season Selector */}
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="h-9 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-text-primary focus:border-pitwall-red focus:outline-none"
            aria-label="Pilih Musim"
          >
            {[2026, 2025, 2024, 2023, 2022, 2021].map((yr) => (
              <option key={yr} value={yr}>
                Musim {yr}
              </option>
            ))}
          </select>

          {/* Export Season .ics */}
          {events.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportAll}
              title="Unduh seluruh jadwal musim dalam format iCalendar (.ics)"
            >
              <Download className="h-3.5 w-3.5 text-text-muted" />
              <span>Ekspor Musim (.ics)</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── 3. LOADING & ERROR STATES ───────────────────────────────────── */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          title="Gagal Memuat Jadwal Kalender"
          description={`Terjadi kendala saat mengambil kalender F1 musim ${season}. Silakan coba lagi.`}
          actionLabel="Muat Ulang Data"
          onAction={() => refetch()}
        />
      )}

      {/* ─── 4. RACE CARDS GRID (3 Columns Desktop, 1 Column Mobile) ─────── */}
      {!isLoading && !isError && (
        <>
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="Tidak Ada Balapan Ditemukan"
              description={`Tidak ada balapan yang cocok dengan filter "${filter}" pada musim ${season}.`}
              actionLabel="Tampilkan Semua Balapan"
              onAction={() => setFilter("ALL")}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => {
                const isExpanded = Boolean(expandedRounds[event.round]);
                const isNext = event.status === "NEXT";
                const isCompleted = event.status === "COMPLETED";
                const hasSprint = event.sessions.some(
                  (s) => s.key === "SPRINT" || s.key === "SPRINT_QUALI"
                );

                return (
                  <Link
                    key={event.round}
                    href={`/calendar/${event.round}?year=${event.season}`}
                    className="block group focus:outline-none"
                  >
                    <Card
                      interactive
                      className={`h-full flex flex-col justify-between overflow-hidden transition-all ${
                        isNext ? "ring-2 ring-pitwall-red/80 shadow-md" : ""
                      }`}
                    >
                      <div className="p-5 space-y-4">
                        {/* Top: Round Badge + Status */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold tracking-wider text-text-muted uppercase">
                            Ronde {String(event.round).padStart(2, "0")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {hasSprint && (
                              <Badge variant="sprint" size="sm">
                                Sprint
                              </Badge>
                            )}
                            <StatusPill status={event.status} />
                          </div>
                        </div>

                        {/* Title: Flag + GP Name */}
                        <div>
                          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary group-hover:text-pitwall-red transition-colors flex items-center gap-2">
                            <span className="text-2xl leading-none">
                              {event.countryFlag}
                            </span>
                            <span className="truncate">{event.raceName}</span>
                          </h3>
                          <p className="mt-1 text-xs text-text-secondary truncate">
                            {event.circuitName}
                          </p>
                        </div>

                        {/* Date & Location */}
                        <div className="text-xs text-text-muted font-medium flex items-center justify-between pt-1 border-t border-border-subtle">
                          <span>{formatWeekendSpan(event.raceUtcIso, locale)}</span>
                          <span>
                            {event.locality}, {event.country}
                          </span>
                        </div>

                        {/* Mini Podium if Completed */}
                        {isCompleted && event.podium && event.podium.length > 0 && (
                          <div className="rounded-lg bg-surface-elevated/70 p-2.5 space-y-1.5">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                              <Trophy className="h-3 w-3" />
                              <span>Hasil Podium</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs">
                              {event.podium.slice(0, 3).map((p) => (
                                <div
                                  key={p.position}
                                  className={`rounded px-1.5 py-1 ${
                                    p.position === 1
                                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-500 font-extrabold"
                                      : "bg-surface text-text-secondary border border-border-subtle"
                                  }`}
                                >
                                  <div className="text-[10px] text-text-muted">
                                    P{p.position}
                                  </div>
                                  <div className="font-bold truncate text-text-primary">
                                    {p.driverCode}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Expandable Schedule Preview */}
                        {isExpanded && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border border-border-subtle bg-surface-elevated/50 p-3 space-y-2 text-xs"
                          >
                            <div className="font-semibold text-text-muted text-[11px] uppercase tracking-wider">
                              Jadwal Lengkap Sesi
                            </div>
                            <div className="divide-y divide-border-subtle">
                              {event.sessions.map((s) => (
                                <div
                                  key={s.key}
                                  className="flex items-center justify-between py-1.5 text-xs"
                                >
                                  <span className="font-medium text-text-secondary">
                                    {s.label}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-mono font-bold tabular-nums text-text-primary">
                                      {formatSessionTime(s.utcIso, "Asia/Jakarta")} WIB
                                    </span>
                                    {isDifferentFromWib(event.circuitTimezoneOffset) && (
                                      <span className="block text-[10px] font-mono text-text-muted">
                                        {formatWithOffset(s.utcIso, event.circuitTimezoneOffset)} Sirkuit
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Quick action buttons */}
                      <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3 text-xs bg-surface-elevated/30">
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(event.round, e)}
                          className="inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <span>{isExpanded ? "Tutup Jadwal" : "Lihat Jadwal"}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleExportSingle(event, e)}
                            className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
                            title="Tambah ke kalender (.ics)"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <span className="inline-flex items-center gap-0.5 font-bold text-pitwall-red group-hover:translate-x-0.5 transition-transform">
                            <span>Detail</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
