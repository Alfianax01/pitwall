import { NextRequest, NextResponse } from "next/server";
import { F1DataService } from "@/lib/f1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSessionKey =
      searchParams.get("session_key") || searchParams.get("sessionKey");
    const sessionKey =
      rawSessionKey && !isNaN(Number(rawSessionKey))
        ? Number(rawSessionKey)
        : undefined;
    const rawYear = searchParams.get("year") || searchParams.get("season");
    const year =
      rawYear && !isNaN(Number(rawYear)) ? Number(rawYear) : undefined;
    const country = searchParams.get("country") || undefined;
    const rawTargetLap =
      searchParams.get("targetLap") || searchParams.get("lap");
    const targetLap =
      rawTargetLap && !isNaN(Number(rawTargetLap))
        ? Number(rawTargetLap)
        : undefined;

    const timing = await F1DataService.getTimingData({
      sessionKey,
      year,
      country,
      targetLap,
    });
    return NextResponse.json(timing);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch timing data" },
      { status: 500 }
    );
  }
}
