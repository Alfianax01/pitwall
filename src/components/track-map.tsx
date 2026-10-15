"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircuitMapPayload,
  TimingTowerRow,
  TrackStatus,
} from "@/lib/f1/schemas";
import { formatLapTime } from "@/lib/f1";

interface TrackMapProps {
  sessionKey: number;
  circuitName: string;
  tower: TimingTowerRow[];
  trackStatus: TrackStatus;
  selectedDriver: number | null;
  onSelectDriver: (driverNumber: number | null) => void;
  isLiveOrPlaying: boolean;
  pitLossSeconds: number;
  onChangePitLoss: (sec: number) => void;
}

export function TrackMap({
  sessionKey,
  circuitName,
  tower,
  trackStatus,
  selectedDriver,
  onSelectDriver,
  isLiveOrPlaying,
  pitLossSeconds,
  onChangePitLoss,
}: TrackMapProps) {
  const { data: mapData, isLoading } = useQuery<CircuitMapPayload>({
    queryKey: ["f1-circuit-map", sessionKey, circuitName],
    queryFn: async () => {
      const res = await fetch(
        `/api/f1/track?session_key=${sessionKey}&circuit=${encodeURIComponent(
          circuitName
        )}`
      );
      if (!res.ok) throw new Error("Gagal memuat peta sirkuit");
      return res.json();
    },
    staleTime: Infinity,
  });

  const [leaderPhase, setLeaderPhase] = useState<number>(0.12);
  const lastFrameRef = useRef<number>(performance.now());

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let lastStateUpdate = performance.now();
    const leaderLapTime = tower[0]?.lastLap || tower[0]?.bestLap || 90;

    const tick = (now: number) => {
      animId = requestAnimationFrame(tick);
      if (!isLiveOrPlaying) return;

      const elapsed = now - lastStateUpdate;
      if (elapsed >= 33) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        lastStateUpdate = now;
        setLeaderPhase((prev) => (prev + dt / leaderLapTime) % 1);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isLiveOrPlaying, tower]);

  const points = useMemo(() => mapData?.points || [], [mapData]);

  const sectorPaths = useMemo(() => {
    if (points.length < 3) return { s1: "", s2: "", s3: "", full: "" };
    const toPath = (pts: typeof points) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    const s1Pts = points.filter((p) => p.sector === 1);
    const s2Pts = points.filter((p) => p.sector === 2);
    const s3Pts = points.filter((p) => p.sector === 3);

    return {
      full: `${toPath(points)} Z`,
      s1: toPath(s1Pts.length ? [...s1Pts, s2Pts[0] || points[0]] : []),
      s2: toPath(s2Pts.length ? [...s2Pts, s3Pts[0] || points[0]] : []),
      s3: toPath(s3Pts.length ? [...s3Pts, points[0]] : []),
    };
  }, [points]);

  const getCoordForGap = useCallback(
    (gapSec: number, refLapSec: number) => {
      if (points.length === 0) return { x: 500, y: 500 };
      const totalPts = points.length;
      const lapOffset = (gapSec / refLapSec) % 1;
      const normalizedProgress = (leaderPhase - lapOffset + 10) % 1;

      const exactIdx = normalizedProgress * (totalPts - 1);
      const idxA = Math.floor(exactIdx) % totalPts;
      const idxB = (idxA + 1) % totalPts;
      const frac = exactIdx - Math.floor(exactIdx);

      const ptA = points[idxA];
      const ptB = points[idxB];

      return {
        x: ptA.x + (ptB.x - ptA.x) * frac,
        y: ptA.y + (ptB.y - ptA.y) * frac,
      };
    },
    [points, leaderPhase]
  );

  const carMarkers = useMemo(() => {
    if (points.length === 0) return [];
    return tower
      .slice()
      .reverse()
      .map((drv) => {
        const refLapSec = drv.lastLap || drv.bestLap || 90;
        const rawGap =
          drv.position === 1
            ? 0
            : drv.gapSeconds > 0
              ? drv.gapSeconds
              : (drv.position - 1) * 1.75;

        const coord = getCoordForGap(rawGap, refLapSec);
        return {
          ...drv,
          x: coord.x,
          y: coord.y,
        };
      });
  }, [points, tower, getCoordForGap]);

  const focusedDriver = tower.find((d) => d.driverNumber === selectedDriver);

  const pitSimulation = useMemo(() => {
    if (!focusedDriver || points.length === 0) return null;
    const refLapSec = focusedDriver.lastLap || focusedDriver.bestLap || 90;
    const currentGap =
      focusedDriver.position === 1
        ? 0
        : focusedDriver.gapSeconds > 0
          ? focusedDriver.gapSeconds
          : (focusedDriver.position - 1) * 1.75;

    const projectedGap = +(currentGap + pitLossSeconds).toFixed(3);
    const ghostCoord = getCoordForGap(projectedGap, refLapSec);

    const others = tower.filter(
      (d) => d.driverNumber !== focusedDriver.driverNumber
    );
    let projectedPos = 1;
    let carAhead: TimingTowerRow | null = null;
    let carBehind: TimingTowerRow | null = null;

    for (const o of others) {
      const oGap =
        o.position === 1
          ? 0
          : o.gapSeconds > 0
            ? o.gapSeconds
            : (o.position - 1) * 1.75;
      if (oGap < projectedGap) {
        projectedPos++;
        carAhead = o;
      } else if (!carBehind) {
        carBehind = o;
      }
    }

    const marginToAhead = carAhead
      ? +(
          projectedGap -
          (carAhead.position === 1 ? 0 : carAhead.gapSeconds)
        ).toFixed(2)
      : 0;
    const marginToBehind = carBehind
      ? +(carBehind.gapSeconds - projectedGap).toFixed(2)
      : 0;

    return {
      projectedGap,
      projectedPos,
      ghostX: ghostCoord.x,
      ghostY: ghostCoord.y,
      carAhead,
      carBehind,
      marginToAhead,
      marginToBehind,
    };
  }, [focusedDriver, pitLossSeconds, points, tower, getCoordForGap]);

  const startPoint = points[0];

  const trackStrokeColor =
    trackStatus === "RED"
      ? "#EF4444"
      : trackStatus === "SC" ||
          trackStatus === "VSC" ||
          trackStatus === "YELLOW"
        ? "#F59E0B"
        : "#26262E";

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-elevated/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-pitwall-red animate-pulse" />
          <span className="font-display text-base font-bold text-text-primary tracking-tight">
            Radar Sirkuit • {circuitName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted text-[11px] font-medium mr-1">
            Pit Window:
          </span>
          <button
            onClick={() => onChangePitLoss(22.0)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              pitLossSeconds === 22.0
                ? "bg-pitwall-red text-white font-bold"
                : "bg-surface text-text-secondary hover:text-text-primary border border-border-subtle"
            }`}
          >
            22s Normal
          </button>
          <button
            onClick={() => onChangePitLoss(14.0)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              pitLossSeconds === 14.0
                ? "bg-amber-500 text-black font-bold"
                : "bg-surface text-text-secondary hover:text-text-primary border border-border-subtle"
            }`}
          >
            14s SC/VSC
          </button>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#050507]">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, #18181b 1px, transparent 1px), linear-gradient(to bottom, #18181b 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {isLoading ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-500">
            LOADING OFFICIAL FIA CIRCUIT GEOMETRY...
          </div>
        ) : (
          <svg viewBox="0 0 1000 1000" className="h-full w-full select-none p-4">
            {/* Track Base Outline */}
            <path
              d={sectorPaths.full}
              fill="none"
              stroke={trackStrokeColor}
              strokeWidth={24}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Asphalt Core */}
            <path
              d={sectorPaths.full}
              fill="none"
              stroke="#0F1015"
              strokeWidth={14}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Sector Lines */}
            <path
              d={sectorPaths.s1}
              fill="none"
              stroke="#EF4444"
              strokeWidth={3}
              strokeOpacity={0.75}
            />
            <path
              d={sectorPaths.s2}
              fill="none"
              stroke="#38BDF8"
              strokeWidth={3}
              strokeOpacity={0.75}
            />
            <path
              d={sectorPaths.s3}
              fill="none"
              stroke="#EAB308"
              strokeWidth={3}
              strokeOpacity={0.75}
            />

            {/* Start / Finish Marker */}
            {startPoint && (
              <g transform={`translate(${startPoint.x}, ${startPoint.y})`}>
                <rect
                  x={-16}
                  y={-12}
                  width={32}
                  height={24}
                  fill="#050507"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <text
                  y={4}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  S/F
                </text>
              </g>
            )}

            {/* PIT EXIT GHOST CAR */}
            {focusedDriver && pitSimulation && (
              <g
                transform={`translate(${pitSimulation.ghostX}, ${pitSimulation.ghostY})`}
                style={{ willChange: "transform" }}
              >
                <circle
                  r={20}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <circle
                  r={8}
                  fill="#050507"
                  stroke="#F59E0B"
                  strokeWidth={3}
                />
                <g transform="translate(-48, -32)">
                  <rect
                    x={0}
                    y={0}
                    width={96}
                    height={18}
                    fill="#F59E0B"
                    stroke="#050507"
                    strokeWidth={1}
                  />
                  <text
                    x={48}
                    y={12}
                    textAnchor="middle"
                    fill="#050507"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {focusedDriver.code} PIT→P{pitSimulation.projectedPos}
                  </text>
                </g>
              </g>
            )}

            {/* 20 Moving Cars */}
            {carMarkers.map((car) => {
              const isSelected = selectedDriver === car.driverNumber;
              const isLeader = car.position === 1;
              const dimmed =
                selectedDriver !== null &&
                selectedDriver !== car.driverNumber &&
                pitSimulation?.carAhead?.driverNumber !== car.driverNumber &&
                pitSimulation?.carBehind?.driverNumber !== car.driverNumber;

              return (
                <g
                  key={car.driverNumber}
                  transform={`translate(${car.x}, ${car.y})`}
                  onClick={() =>
                    onSelectDriver(isSelected ? null : car.driverNumber)
                  }
                  className="cursor-pointer"
                  style={{ opacity: dimmed ? 0.3 : 1, willChange: "transform" }}
                >
                  {(isLeader || isSelected) && (
                    <circle
                      r={isSelected ? 22 : 16}
                      fill="none"
                      stroke={car.teamColor}
                      strokeWidth={2}
                      strokeOpacity={0.7}
                    />
                  )}

                  <circle
                    r={isSelected ? 11 : isLeader ? 9 : 7.5}
                    fill={car.teamColor}
                    stroke="#050507"
                    strokeWidth={2}
                  />

                  <g transform="translate(12, -10)">
                    <rect
                      x={0}
                      y={-11}
                      width={42}
                      height={16}
                      fill="#050507"
                      fillOpacity={0.92}
                      stroke={isSelected ? "#FFFFFF" : car.teamColor}
                      strokeWidth={1.2}
                    />
                    <text
                      x={21}
                      y={0}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {car.code}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-3 border border-[#1F1F24] bg-[#050507]/95 px-2.5 py-1 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-red-400">
            <span className="h-1.5 w-3 bg-red-500" /> S1
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="h-1.5 w-3 bg-sky-400" /> S2
          </span>
          <span className="flex items-center gap-1 text-yellow-400">
            <span className="h-1.5 w-3 bg-yellow-400" /> S3
          </span>
          <span className="text-zinc-500">• FIA GEOJSON</span>
        </div>
      </div>

      {/* Telemetry Lock & Pit Window Output */}
      {focusedDriver && pitSimulation && (
        <div className="divide-y divide-[#1F1F24] border-t border-[#1F1F24] bg-[#0D0D12] font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className="h-3.5 w-1.5"
                style={{ backgroundColor: focusedDriver.teamColor }}
              />
              <span className="font-black text-white">
                LOCKED: P{focusedDriver.position} {focusedDriver.code}
              </span>
              <span className="text-[11px] text-zinc-400">
                GAP {focusedDriver.gapToLeader} {"//"} LAST{" "}
                {formatLapTime(focusedDriver.lastLap)}
              </span>
            </div>
            <button
              onClick={() => onSelectDriver(null)}
              className="border border-[#27272D] bg-[#08080A] px-2 py-0.5 text-[10px] font-bold text-zinc-400 hover:border-white hover:text-white"
            >
              CLEAR LOCK
            </button>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[#1F1F24] bg-[#08080B] text-[11px]">
            <div className="p-2">
              <div className="text-[9px] uppercase text-zinc-500">
                REJOIN POSITION
              </div>
              <div className="mt-0.5 font-black text-amber-400">
                P{pitSimulation.projectedPos}{" "}
                <span className="font-normal text-zinc-500">
                  (+{pitLossSeconds}s)
                </span>
              </div>
            </div>
            <div className="p-2">
              <div className="text-[9px] uppercase text-zinc-500">
                TRAFFIC AHEAD
              </div>
              <div className="mt-0.5 font-bold text-zinc-200">
                {pitSimulation.carAhead
                  ? `${pitSimulation.carAhead.code} (-${pitSimulation.marginToAhead}s)`
                  : "CLEAN AIR (P1)"}
              </div>
            </div>
            <div className="p-2">
              <div className="text-[9px] uppercase text-zinc-500">
                UNDERCUT CUSHION
              </div>
              <div className="mt-0.5 font-bold text-emerald-400">
                {pitSimulation.carBehind
                  ? `${pitSimulation.carBehind.code} (+${pitSimulation.marginToBehind}s)`
                  : "CLEAR BEHIND"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

