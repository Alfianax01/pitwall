"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarEvent, SessionScheduleItem } from "@/lib/f1/schemas";
import { downloadIcsFile } from "@/lib/f1/ics";
import { useUI } from "@/components/providers";
import {
  Download,
  ChevronLeft,
  Activity,
  LineChart,
  MapPin,
  Trophy,
  Clock,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CountdownBlock } from "@/components/ui/countdown-block";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatInTimezone(utcIso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      hour12: false,
    }).format(new Date(utcIso));
  } catch {
    return "-";
  }
}

function formatFullDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(
      locale === "id" ? "id-ID" : "en-US",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );
  } catch {
    return "-";
  }
}

function RoundDetailContent() {
  const { locale, t } = useUI();
  const params = useParams();
  const searchParams = useSearchParams();
  const round = params.round as string;
  const currentYear = new Date().getFullYear();
  const yearParam = searchParams.get("year");
  const season = yearParam ? parseInt(yearParam, 10) : currentYear;

  const [userTz, setUserTz] = useState<string>("Asia/Jakarta");
  const [nowMs, setNowMs] = useState<number>(Date.now());

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

  const {
    data: eventData,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ event?: CalendarEvent } | CalendarEvent>({
    queryKey: ["calendar-round", season, round],
    queryFn: async () => {
      const res = await fetch(`/api/f1/calendar/${round}?year=${season}`);
      if (!res.ok) throw new Error("Gagal mengambil data ronde");
      return res.json();
    },
  });

  const event: CalendarEvent | null = useMemo(() => {
    if (!eventData) return null;
    if ("event" in eventData && eventData.event) return eventData.event;
    return eventData as CalendarEvent;
  }, [eventData]);

  const nextSession = useMemo(() => {
    if (!event) return null;
    return (
      event.sessions.find((s) => new Date(s.utcIso).getTime() > nowMs) ||
      event.sessions[event.sessions.length - 1]
    );
  }, [event, nowMs]);

  const countdown = useMemo(() => {
    if (!nextSession) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = Math.max(0, new Date(nextSession.utcIso).getTime() - nowMs);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
  }, [nextSession, nowMs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Kembali ke Kalender</span>
        </Link>
        <EmptyState
          title="Data Grand Prix Tidak Ditemukan"
          description={`Ronde ${round} untuk musim ${season} tidak dapat dimuat atau belum tersedia.`}
          actionLabel="Coba Lagi"
          onAction={() => refetch()}
        />
      </div>
    );
  }

  const isCompleted = event.status === "COMPLETED";
  const hasSprint = event.sessions.some((s) => s.key === "SPRINT");
  const isDifferentTz =
    event.circuitTimezoneOffset !== "+07:00" &&
    event.circuitTimezoneOffset !== "+07";

  return (
    <div className="space-y-8 pb-16">
      {/* Back button */}
      <div>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Kembali ke Kalender Musim {season}</span>
        </Link>
      </div>

      {/* ─── HERO HEADER ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 lg:p-10 shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
                Ronde {String(event.round).padStart(2, "0")} • Musim {event.season}
              </span>
              <StatusPill status={event.status} />
              {hasSprint && (
                <Badge variant="sprint" size="sm">
                  <Flame className="h-3 w-3" /> Sprint Weekend
                </Badge>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-text-primary">
              <span className="mr-2 text-3xl sm:text-4xl lg:text-5xl inline-block">
                {event.countryFlag}
              </span>
              {event.raceName}
            </h1>

            <p className="flex items-center gap-2 text-sm sm:text-base text-text-secondary font-medium">
              <MapPin className="h-4 w-4 text-pitwall-red shrink-0" />
              <span>{event.circuitName}</span>
              <span className="text-text-muted">•</span>
              <span>
                {event.locality}, {event.country}
              </span>
              <span className="text-xs text-text-muted">
                (UTC{event.circuitTimezoneOffset})
              </span>
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/live?year=${event.season}&country=${encodeURIComponent(
                  event.country
                )}`}
              >
                <Button variant="primary" size="md">
                  <Activity className="h-4 w-4" />
                  <span>Buka Live Timing</span>
                </Button>
              </Link>
              <Link
                href={`/analysis?year=${event.season}&country=${encodeURIComponent(
                  event.country
                )}`}
              >
                <Button variant="secondary" size="md">
                  <LineChart className="h-4 w-4 text-text-muted" />
                  <span>Analisis Telemetri</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="md"
                onClick={() =>
                  downloadIcsFile(`F1-${event.season}-R${event.round}.ics`, [event])
                }
              >
                <Download className="h-4 w-4 text-text-muted" />
                <span>Ekspor Jadwal (.ics)</span>
              </Button>
            </div>
          </div>

          {/* Countdown (if not completed) */}
          {!isCompleted && nextSession && (
            <div className="rounded-xl border border-border-subtle bg-surface-elevated/70 p-5 lg:min-w-[340px]">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Hitung Mundur: <strong className="text-text-primary">{nextSession.label}</strong>
              </div>
              <CountdownBlock
                days={countdown.days}
                hours={countdown.hours}
                minutes={countdown.minutes}
                seconds={countdown.seconds}
              />
            </div>
          )}
        </div>
      </section>

      {/* ─── TWO COLUMN CONTENT: JADWAL & HASIL ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Jadwal Sesi Akhir Pekan */}
        <div className={isCompleted ? "lg:col-span-5" : "lg:col-span-12"}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-pitwall-red" />
                <span>Jadwal Sesi Pekan Balap</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {event.sessions.map((ses) => {
                  const isRace = ses.key === "RACE";
                  return (
                    <div
                      key={ses.key}
                      className={`flex items-center justify-between p-4 transition-colors ${
                        isRace ? "bg-pitwall-red/5 font-semibold" : ""
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              isRace ? "bg-pitwall-red" : "bg-text-muted"
                            }`}
                          />
                          <span className="text-sm font-bold text-text-primary">
                            {ses.label}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted pl-4">
                          {formatFullDate(ses.utcIso, locale)}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-sm font-bold tabular-nums text-text-primary">
                          {formatInTimezone(ses.utcIso, "Asia/Jakarta")}{" "}
                          <span className="text-xs text-text-muted font-normal">
                            WIB
                          </span>
                        </div>
                        {isDifferentTz && (
                          <div className="font-mono text-xs text-text-muted tabular-nums">
                            {formatWithOffset(ses.utcIso, event.circuitTimezoneOffset)}{" "}
                            Sirkuit
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Hasil Klasifikasi (if completed) */}
        {isCompleted && event.fullResults && event.fullResults.length > 0 && (
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span>Hasil Klasifikasi Balapan</span>
                  </CardTitle>
                  <span className="text-xs text-text-muted font-mono">
                    Top 20 Finisher
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-[11px] font-semibold text-text-muted uppercase tracking-wider bg-surface-elevated/40">
                      <th className="py-2.5 px-4 w-12 text-center">Pos</th>
                      <th className="py-2.5 px-3">Pembalap</th>
                      <th className="py-2.5 px-3">Konstruktor</th>
                      <th className="py-2.5 px-4 text-right">Waktu / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-mono">
                    {event.fullResults.map((res) => {
                      const isPodium = res.position <= 3;
                      return (
                        <tr
                          key={res.position}
                          className={`hover:bg-surface-hover/50 transition-colors ${
                            isPodium ? "bg-amber-500/5 font-semibold" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                res.position === 1
                                  ? "bg-amber-500 text-black font-extrabold"
                                  : res.position === 2
                                    ? "bg-slate-300 dark:bg-slate-700 text-text-primary"
                                    : res.position === 3
                                      ? "bg-amber-700/60 text-white"
                                      : "text-text-muted font-normal"
                              }`}
                            >
                              {res.position}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-text-primary">
                              {res.driverCode}{" "}
                              <span className="font-normal font-sans text-text-secondary text-xs hidden sm:inline">
                                {res.driverName}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-text-secondary text-xs">
                            {res.constructorName}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-text-primary font-medium">
                            {res.timeOrStatus}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoundDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <RoundDetailContent />
    </React.Suspense>
  );
}
