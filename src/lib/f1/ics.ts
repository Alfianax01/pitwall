import { CalendarEvent } from "./schemas";

function toIcsDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function generateIcsContent(events: CalendarEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PitWall F1 Dashboard//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    for (const s of ev.sessions) {
      const start = new Date(s.utcIso);
      const durationHours = s.key === "RACE" ? 2 : 1;
      const end = new Date(start.getTime() + durationHours * 3600 * 1000);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:pitwall-${ev.season}-r${ev.round}-${s.key}@pitwall.local`);
      lines.push(`DTSTAMP:${toIcsDate(new Date().toISOString())}`);
      lines.push(`DTSTART:${toIcsDate(start.toISOString())}`);
      lines.push(`DTEND:${toIcsDate(end.toISOString())}`);
      lines.push(`SUMMARY:[F1] ${ev.raceName} - ${s.label}`);
      lines.push(`LOCATION:${ev.circuitName}, ${ev.locality}, ${ev.country}`);
      lines.push(
        `DESCRIPTION:Ronde ${ev.round} Musim ${ev.season} - ${ev.raceName} (${s.label})`
      );
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(filename: string, events: CalendarEvent[]) {
  const content = generateIcsContent(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
