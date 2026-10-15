import { NextRequest, NextResponse } from "next/server";
import { F1DataService } from "@/lib/f1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const currentYear = new Date().getFullYear();
    const rawSeason = searchParams.get("season") || searchParams.get("year");
    const season =
      rawSeason && !isNaN(Number(rawSeason))
        ? Number(rawSeason)
        : currentYear;

    const calendar = await F1DataService.getSeasonCalendar(season);
    return NextResponse.json({
      season,
      events: calendar,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}
