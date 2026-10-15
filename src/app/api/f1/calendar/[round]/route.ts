import { NextRequest, NextResponse } from "next/server";
import { F1DataService } from "@/lib/f1";

export async function GET(
  req: NextRequest,
  { params }: { params: { round: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const currentYear = new Date().getFullYear();
    const rawSeason = searchParams.get("season") || searchParams.get("year");
    const season =
      rawSeason && !isNaN(Number(rawSeason))
        ? Number(rawSeason)
        : currentYear;

    const round = Number(params.round);
    if (isNaN(round)) {
      return NextResponse.json({ error: "Invalid round parameter" }, { status: 400 });
    }

    const detail = await F1DataService.getRoundDetail(season, round);
    if (!detail) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch round detail" },
      { status: 500 }
    );
  }
}
