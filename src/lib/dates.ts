export function warsawTodayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(now);
}

// Daty służb pochodzą z pól typu date i są zapisywane jako północ UTC.
export function dutyDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
