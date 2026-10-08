export interface BrigadeScheduleLike {
  id?: string;
  lineId?: string;
  brigadeNumber: string;
  carrier?: string | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  firstStopDeparture?: string | null;
  lastStopArrival?: string | null;
  driverChanges?: string | null;
  line?: {
    id?: string;
    number: string;
    carrier?: string | null;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

/**
 * Wykrywa typ dnia na podstawie tekstu (numeru brygady lub uwag).
 * 1 - Dni robocze / powszednie
 * 2 - Sobotni
 * 2.5 - Weekend
 * 3 - Niedzielny / Święta
 * 0 - Nie rozpoznano
 */
function detectDay(text?: string | null): number {
  if (!text) return 0;
  const lower = text.toLowerCase();

  // Dni robocze / powszednie
  if (
    lower.includes("roboc") ||
    lower.includes("powszed") ||
    lower.includes("pn-pt") ||
    lower.includes("pon-pt") ||
    lower.includes("pn - pt") ||
    lower.includes("pon - pt") ||
    /\b(dp)\b/i.test(lower)
  ) {
    return 1;
  }

  // Sobota / Niedziela / Święta
  const hasSob = lower.includes("sobot") || /\b(sob|sb)\b/i.test(lower);
  const hasNdz =
    lower.includes("niedziel") ||
    lower.includes("święt") ||
    lower.includes("swiet") ||
    /\b(ndz|nd)\b/i.test(lower);

  if (hasSob && hasNdz) {
    return 2.5;
  }
  if (hasSob) {
    return 2;
  }
  if (hasNdz) {
    return 3;
  }

  return 0;
}

/**
 * Zwraca wagę sortowania dnia:
 * 1 - Dni robocze (domyślne)
 * 2 - Sobotni
 * 2.5 - Weekend
 * 3 - Niedzielny / Święta
 */
export function getDayOrder(brigadeNumber?: string | null, notes?: string | null): number {
  const brigOrder = detectDay(brigadeNumber);
  if (brigOrder !== 0) return brigOrder;

  const notesOrder = detectDay(notes);
  if (notesOrder !== 0) return notesOrder;

  // Domyślnie traktujemy jako dni robocze (podstawowy grafik)
  return 1;
}

/**
 * Czytelna etykieta typu dnia
 */
export function getDayLabel(brigadeNumber?: string | null, notes?: string | null): string {
  const order = getDayOrder(brigadeNumber, notes);
  if (order === 1) return "Dni robocze";
  if (order === 2) return "Sobota";
  if (order === 2.5) return "Weekend";
  if (order === 3) return "Niedziela i Święta";
  return "Dni robocze";
}

/**
 * Klasy Tailwind dla plakietki typu dnia
 */
export function getDayBadgeClass(brigadeNumber?: string | null, notes?: string | null): string {
  const order = getDayOrder(brigadeNumber, notes);
  if (order === 1) return "bg-emerald-950/70 border-emerald-800 text-emerald-300";
  if (order === 2) return "bg-blue-950/70 border-blue-800 text-blue-300";
  if (order === 2.5) return "bg-indigo-950/70 border-indigo-800 text-indigo-300";
  if (order === 3) return "bg-amber-950/70 border-amber-800 text-amber-300";
  return "bg-slate-800 border-slate-700 text-slate-300";
}

/**
 * Sortuje brygady wg reguły:
 * 1. Numer linii (naturalnie: 1, 2, 10, 34...)
 * 2. Typ dnia: Dni robocze (1) -> Sobotni (2) -> Niedzielny (3)
 * 3. Numer brygady (naturalnie: 1/1, 1/2, 1/10...)
 * 4. Godzina rozpoczęcia
 */
export function sortBrigades<T extends BrigadeScheduleLike>(schedules: T[]): T[] {
  return [...schedules].sort((a, b) => {
    // 1. Linia
    const lineA = a.line?.number || "";
    const lineB = b.line?.number || "";
    const lineCmp = lineA.localeCompare(lineB, "pl", { numeric: true });
    if (lineCmp !== 0) return lineCmp;

    // 2. Dzień tygodnia (Dni robocze -> Sobotni -> Niedzielny)
    const dayA = getDayOrder(a.brigadeNumber, a.notes);
    const dayB = getDayOrder(b.brigadeNumber, b.notes);
    if (dayA !== dayB) return dayA - dayB;

    // 3. Numer brygady naturalnie
    const brigCmp = a.brigadeNumber.localeCompare(b.brigadeNumber, "pl", { numeric: true });
    if (brigCmp !== 0) return brigCmp;

    // 4. Godzina wyjazdu
    const startA = a.startTime || "";
    const startB = b.startTime || "";
    return startA.localeCompare(startB);
  });
}
