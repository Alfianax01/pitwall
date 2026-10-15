"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarEvent, TimingPayload } from "@/lib/f1/schemas";
import { formatLapTime } from "@/lib/f1";
import { useI18n } from "@/components/providers";

export default function HomePage() {
  const { t, locale } = useI18n();
  const currentYear = new Date().getFullYear();

  // Load calendar to get next race and recent completed race
  // API expects ?year=, response shape is { season, events }
  const { data: calendar } = useQuery<CalendarEvent[]>({
    queryKey: ["homeCalendar", currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/f1/calendar?year=${currentYear}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.events || [];
    },
  });

  // Load live timing preview
  const { data: timing } = useQuery<TimingPayload>({
    queryKey: ["homeTiming"],
    queryFn: async () => {
      const res = await fetch(`/api/f1/timing`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const nextRace = calendar?.find((r) => r.status === "NEXT");
  const completedRaces = calendar?.filter((r) => r.status === "COMPLETED") || [];
  const latestCompletedRace =
    completedRaces.length > 0 ? completedRaces[completedRaces.length - 1] : null;

  // Countdown timer for next race
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!nextRace) return;
    const target = new Date(nextRace.raceUtcIso).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextRace]);

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner */}
      <section className="border border-[#1F1F24] bg-[#0A0A0D]">
        <div className="border-b border-[#1F1F24] px-6 py-2 flex items-center gap-3">
          <div className="w-2 h-2 bg-[#E10600]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#E10600]">
            PITWALL.SYS / FORMULA 1 INTELLIGENCE PLATFORM
          </span>
        </div>

        <div className="px-6 py-10 sm:px-10 sm:py-14 max-w-3xl space-y-5">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#555560]">
              {currentYear} SEASON - ACTIVE
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
              Live Timing &amp; Telemetri F1
            </h1>
          </div>

          <p className="text-sm text-[#8888A0] leading-relaxed max-w-xl">
            {locale === "id"
              ? "Platform dashboard komunitas untuk penggemar Formula 1. Timing tower real-time, scrubber replay lap-by-lap, grafik telemetri interaktif, dan kalender musim lengkap."
              : "Community dashboard for Formula 1 fans. Real-time timing tower, lap-by-lap replay scrubber, interactive telemetry charts, and full season schedule."}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/live"
              className="flex items-center gap-2 bg-[#E10600] border border-[#E10600] px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-[#C00500] transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-white" />
              {t("navLive")}
            </Link>

            <Link
              href="/analysis"
              className="flex items-center gap-2 border border-[#27272D] bg-[#0F0F14] px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#CCCCDD] hover:border-[#E10600] hover:text-white transition-colors"
            >
              {t("navAnalysis")}
            </Link>

            <Link
              href="/calendar"
              className="flex items-center gap-2 border border-[#27272D] bg-[#0F0F14] px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#CCCCDD] hover:border-[#27272D] hover:text-white transition-colors"
            >
              {t("navCalendar")}
            </Link>
          </div>
        </div>
      </section>

      {/* Next Race + Live Timing Grid */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Next Race Countdown */}
        {nextRace ? (
          <div className="border border-[#1F1F24] bg-[#0A0A0D] flex flex-col justify-between">
            <div className="border-b border-[#1F1F24] px-4 py-2 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#E10600]">
                {t("nextRace").toUpperCase()} / RND {nextRace.round}
              </span>
              <span className="text-lg leading-none">{nextRace.countryFlag}</span>
            </div>

            <div className="px-5 py-5 space-y-4 flex-1">
              <div>
                <h3 className="text-xl font-black text-white">{nextRace.raceName}</h3>
                <p className="mt-1 font-mono text-[11px] text-[#555560]">
                  {nextRace.circuitName} / {nextRace.locality}
                </p>
              </div>

              {timeLeft && (
                <div className="border border-[#1F1F24] bg-[#050507] p-4">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#555560] mb-3">
                    {t("countdownTo")} Grand Prix
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    {[
                      { val: timeLeft.days, label: "DAYS" },
                      { val: timeLeft.hours, label: "HRS" },
                      { val: timeLeft.minutes, label: "MIN" },
                      { val: timeLeft.seconds, label: "SEC" },
                    ].map(({ val, label }, i) => (
                      <div key={label} className="border border-[#1F1F24] bg-[#0A0A0D] p-2">
                        <div
                          className={`text-2xl font-black ${
                            i === 3 ? "text-[#E10600]" : "text-white"
                          }`}
                        >
                          {String(val).padStart(2, "0")}
                        </div>
                        <div className="text-[8px] uppercase text-[#555560] mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#1F1F24] px-5 py-3 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#555560]">
                {new Date(nextRace.raceUtcIso).toLocaleDateString()}
              </span>
              <Link
                href={`/calendar/${nextRace.round}?season=${currentYear}`}
                className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E10600] hover:text-white transition-colors"
              >
                {t("roundDetail")} /&gt;
              </Link>
            </div>
          </div>
        ) : (
          <div className="border border-[#1F1F24] bg-[#0A0A0D] flex items-center justify-center h-48">
            <span className="font-mono text-[10px] uppercase text-[#555560]">
              No upcoming race data
            </span>
          </div>
        )}

        {/* Live Timing Preview */}
        <div className="border border-[#1F1F24] bg-[#0A0A0D] flex flex-col justify-between">
          <div className="border-b border-[#1F1F24] px-4 py-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#E10600]">
              {timing?.mode === "LIVE" ? "LIVE SESSION" : "SESSION REPLAY"}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 ${
                  timing?.mode === "LIVE" ? "bg-[#E10600]" : "bg-[#555560]"
                }`}
              />
              <span className="font-mono text-[9px] uppercase text-[#8888A0]">
                {timing?.mode ?? "OFFLINE"}
              </span>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4 flex-1">
            <div>
              <h3 className="text-xl font-black text-white">
                {timing?.session.circuitName ?? "Circuit Telemetry"}
              </h3>
              <p className="font-mono text-[11px] text-[#555560] mt-1">
                {timing?.session.year} {timing?.session.countryName} /{" "}
                {timing?.session.sessionName}
              </p>
            </div>

            {timing?.tower && (
              <div className="border border-[#1F1F24] bg-[#050507] p-3 space-y-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-[#555560] mb-2">
                  TOP STANDINGS
                </div>
                {timing.tower.slice(0, 3).map((d) => (
                  <div
                    key={d.driverNumber}
                    className="flex items-center justify-between font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#555560] font-bold w-5">P{d.position}</span>
                      <div className="w-0.5 h-4" style={{ backgroundColor: d.teamColor }} />
                      <span className="font-black text-white">{d.code}</span>
                      <span className="text-[#8888A0] text-[10px] truncate max-w-[100px]">
                        {d.fullName}
                      </span>
                    </div>
                    <span className="text-[#CCCCDD] font-semibold">{d.interval}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#1F1F24] px-5 py-3 flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#555560]">
              LAP {timing?.currentLap ?? "--"} / {timing?.totalLaps ?? "--"}
            </span>
            <Link
              href="/live"
              className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E10600] hover:text-white transition-colors"
            >
              Open PitWall Live /&gt;
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 border-b border-[#1F1F24] pb-3">
          <div className="w-1 h-4 bg-[#E10600]" />
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-[#8888A0]">
            Platform Features
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              tag: "LIVE",
              title: "Live Timing Tower",
              desc:
                locale === "id"
                  ? "Posisi real-time, interval, gap ke leader, animasi flash gain/loss, dan status bendera balap."
                  : "Real-time positions, interval to car ahead, gap to leader, flash gain/loss animation, flag status.",
              accent: "#E10600",
              href: "/live",
            },
            {
              tag: "REPLAY",
              title: "Lap Replay Scrubber",
              desc:
                locale === "id"
                  ? "Scrub maju-mundur lap demi lap untuk mengulang overtake, pit stop, dan insiden safety car."
                  : "Scrub forward and back lap-by-lap to review overtakes, pit stops, and safety car incidents.",
              accent: "#F59E0B",
              href: "/live",
            },
            {
              tag: "ANALYSIS",
              title: "Telemetry Charts",
              desc:
                locale === "id"
                  ? "Perbandingan pace multi-driver, degradasi ban, gap to leader, dan visualisasi stint ban."
                  : "Multi-driver pace comparison, tyre degradation, gap to leader, and stint strategy visualization.",
              accent: "#3B82F6",
              href: "/analysis",
            },
            {
              tag: "SCHEDULE",
              title: "Calendar & iCal Export",
              desc:
                locale === "id"
                  ? "Jadwal lengkap dengan konversi waktu sirkuit vs WIB, ekspor sinkronisasi ke Google Calendar."
                  : "Full schedule with circuit time vs local conversion, sync export to Google Calendar and Apple iCal.",
              accent: "#10B981",
              href: "/calendar",
            },
          ].map(({ tag, title, desc, accent, href }) => (
            <Link
              key={tag}
              href={href}
              className="group border border-[#1F1F24] bg-[#0A0A0D] p-5 space-y-3 hover:border-[#27272D] transition-colors block"
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: accent }}
                >
                  {tag}
                </span>
                <span className="font-mono text-[9px] text-[#27272D] group-hover:text-[#555560] transition-colors">
                  /&gt;
                </span>
              </div>
              <h3 className="font-black text-sm text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-[#8888A0]">{desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
