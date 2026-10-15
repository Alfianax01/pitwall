"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, Trophy, Flag, Calendar, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamStripe } from "@/components/ui/team-stripe";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function DriverProfilePage() {
  const params = useParams<{ driverId: string }>();

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["f1-driver-profile", params.driverId],
    queryFn: async () => {
      const res = await fetch(`/api/f1/drivers/${params.driverId}`);
      if (!res.ok) throw new Error("Gagal memuat profil pembalap");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-80 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-72 rounded-xl lg:col-span-5" />
          <Skeleton className="h-72 rounded-xl lg:col-span-7" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 pb-16">
        <Link
          href="/standings"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Kembali ke Klasemen</span>
        </Link>
        <EmptyState
          title="Profil Pembalap Tidak Ditemukan"
          description={`Data untuk pembalap "${params.driverId}" tidak dapat ditemukan.`}
          actionLabel="Coba Lagi"
          onAction={() => refetch()}
        />
      </div>
    );
  }

  const { identity, careerStats, teamTimeline, seasonHistory, recentResults } = data;

  return (
    <div className="space-y-8 pb-16">
      {/* Back to Standings */}
      <div>
        <Link
          href="/standings"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Kembali ke Klasemen Pembalap</span>
        </Link>
      </div>

      {/* ─── 1. HERO PROFILE CARD ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 lg:p-10 shadow-sm">
        {/* Subtle team color gradient */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-96 w-96 opacity-10 blur-3xl"
          style={{ backgroundColor: identity.teamColor || "#E10600" }}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Driver Portrait & Permanent Number */}
          <div className="flex flex-col items-center lg:col-span-4 lg:items-start">
            <div className="relative">
              {identity.headshotUrl ? (
                <div className="relative h-60 w-60 overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated shadow-md">
                  <img
                    src={identity.headshotUrl}
                    alt={identity.fullName}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              ) : (
                <div
                  className="flex h-60 w-60 items-center justify-center rounded-2xl font-display text-6xl font-black text-white shadow-md"
                  style={{ backgroundColor: identity.teamColor || "#E10600" }}
                >
                  {identity.code}
                </div>
              )}

              {/* Number Badge */}
              <div
                className="absolute -bottom-3 -right-3 flex h-14 w-14 items-center justify-center rounded-xl font-display text-2xl font-black text-white shadow-lg border-2 border-surface"
                style={{ backgroundColor: identity.teamColor || "#E10600" }}
              >
                #{identity.permanentNumber}
              </div>
            </div>
          </div>

          {/* Identity & Key Career Highlights */}
          <div className="space-y-6 lg:col-span-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <TeamStripe color={identity.teamColor} size="md" />
                <span className="text-sm font-bold text-text-primary">
                  {identity.currentTeam}
                </span>
                <span className="text-text-muted">•</span>
                <span className="font-mono text-xs font-semibold text-text-muted">
                  {identity.code}
                </span>
                <Badge variant="outline" size="sm">
                  {identity.nationality}
                </Badge>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-text-primary">
                {identity.fullName}
              </h1>

              <p className="text-sm text-text-secondary font-medium">
                Lahir pada {identity.dateOfBirth} ({calculateAge(identity.dateOfBirth)} tahun) • Debut di {careerStats.firstRace}
              </p>
            </div>

            {/* Quick Stat Blocks */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
              <div className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Juara Dunia
                </span>
                <span className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-amber-500">
                  {careerStats.championships}x
                </span>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Kemenangan
                </span>
                <span className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-text-primary">
                  {careerStats.wins}
                  <span className="text-xs font-normal text-text-muted ml-1">
                    ({careerStats.winRate}%)
                  </span>
                </span>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Podium
                </span>
                <span className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-emerald-500">
                  {careerStats.podiums}
                </span>
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface-elevated/50 p-4">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Total Poin
                </span>
                <span className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-text-primary">
                  {careerStats.points}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. CAREER TIMELINE & POINTS PROGRESSION CHART ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Riwayat Tim */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Perjalanan Tim Konstruktor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {teamTimeline
                  .slice()
                  .reverse()
                  .map((stint: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 hover:bg-surface-hover/50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-text-primary text-sm">
                          {stint.teamName}
                        </div>
                        <div className="text-xs text-text-muted font-medium">
                          {stint.startYear === stint.endYear
                            ? `Musim ${stint.startYear}`
                            : `Musim ${stint.startYear} - ${stint.endYear}`}{" "}
                          ({stint.seasonsCount} musim)
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs tabular-nums">
                        <div className="font-bold text-text-primary">
                          {stint.points} PTS
                        </div>
                        <div className="text-amber-500 font-semibold">
                          {stint.wins} Menang
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Points Chart per Season */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Performa Poin per Musim</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seasonHistory}>
                    <defs>
                      <linearGradient id="driverPointsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={identity.teamColor || "#E10600"}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={identity.teamColor || "#E10600"}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border-subtle)"
                    />
                    <XAxis
                      dataKey="season"
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="var(--color-text-muted)"
                      tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border-strong)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${val} Poin`, "Poin Musim"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="points"
                      stroke={identity.teamColor || "#E10600"}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#driverPointsGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
