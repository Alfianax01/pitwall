import { NextRequest, NextResponse } from "next/server";
import { F1DataService } from "@/lib/f1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year") || searchParams.get("season");
    const requestedYear =
      yearParam && !isNaN(parseInt(yearParam, 10))
        ? parseInt(yearParam, 10)
        : new Date().getFullYear();

    const sessions = await F1DataService.listSessions(requestedYear);
    const resolvedYear =
      sessions.length > 0 ? sessions[0].year : requestedYear;

    // Kelompokkan berdasarkan meeting_key (Sirkuit / Grand Prix)
    const meetingsMap = new Map<
      number,
      {
        meeting_key: number;
        country_name: string;
        circuit_short_name: string;
        location: string;
        year: number;
        date_start: string;
        sessions: typeof sessions;
      }
    >();

    for (const s of sessions) {
      if (!meetingsMap.has(s.meeting_key)) {
        meetingsMap.set(s.meeting_key, {
          meeting_key: s.meeting_key,
          country_name: s.country_name,
          circuit_short_name: s.circuit_short_name,
          location: s.location || s.country_name,
          year: s.year,
          date_start: s.date_start,
          sessions: [],
        });
      }
      meetingsMap.get(s.meeting_key)!.sessions.push(s);
    }

    const meetings = Array.from(meetingsMap.values()).sort(
      (a, b) =>
        new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    );

    return NextResponse.json({
      requestedYear,
      resolvedYear,
      sessions,
      meetings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Gagal memuat daftar sirkuit & sesi" },
      { status: 500 }
    );
  }
}

