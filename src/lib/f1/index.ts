import {
  getRoundDetail,
  getSeasonCalendar,
  getSeasonStandings,
} from "./jolpica-provider";
import { getSessionTimingData, listOpenF1Sessions } from "./openf1-provider";

export const F1DataService = {
  getSeasonCalendar,
  getRoundDetail,
  getSeasonStandings,
  listSessions: listOpenF1Sessions,
  getTimingData: getSessionTimingData,
};

export function formatLapTime(seconds: number | null | undefined): string {
  if (
    seconds === null ||
    seconds === undefined ||
    isNaN(seconds) ||
    seconds <= 0
  ) {
    return "-";
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsFormatted = secs < 10 ? `0${secs.toFixed(3)}` : secs.toFixed(3);
  return mins > 0 ? `${mins}:${secsFormatted}` : `${secs.toFixed(3)}s`;
}
