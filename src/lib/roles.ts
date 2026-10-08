export type AppRole =
  | "KIEROWCA"
  | "DYSPOZYTOR"
  | "KIEROWNIK_PRZEWOZOW"
  | "MECHANIK"
  | "SPRAWDZAJACY"
  | "WLASCICIEL"
  | "ZARZAD";

export interface RoleInfo {
  key: AppRole;
  label: string;
  prefix: string;
  rangeMax: number;
  description: string;
  badgeClass: string;
}

export const ROLES: Record<AppRole, RoleInfo> = {
  WLASCICIEL: {
    key: "WLASCICIEL",
    label: "Właściciel",
    prefix: "W",
    rangeMax: 1, // 0 do 1
    description: "Pełne uprawnienia administratora i zarządzania całą firmą",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  },
  ZARZAD: {
    key: "ZARZAD",
    label: "Właściciel / Zarząd",
    prefix: "W",
    rangeMax: 1,
    description: "Pełne uprawnienia administratora i zarządu",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  },
  DYSPOZYTOR: {
    key: "DYSPOZYTOR",
    label: "Dyspozytor",
    prefix: "D",
    rangeMax: 99, // 1 do 99
    description: "Przydziela służby do grafiku i koordynuje ruch",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  },
  KIEROWNIK_PRZEWOZOW: {
    key: "KIEROWNIK_PRZEWOZOW",
    label: "Kierownik Działu Przewozów",
    prefix: "P",
    rangeMax: 99, // 1 do 99
    description: "Zarządza liniami, trasami i wykazem brygad",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
  },
  MECHANIK: {
    key: "MECHANIK",
    label: "Mechanik",
    prefix: "M",
    rangeMax: 99, // 1 do 99
    description: "Zarządza taborem, naprawami i warsztatem technicznym",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  },
  SPRAWDZAJACY: {
    key: "SPRAWDZAJACY",
    label: "Sprawdzający",
    prefix: "S",
    rangeMax: 99, // 1 do 99
    description: "Sprawdza i zatwierdza wnioski pracownicze oraz raporty",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  },
  KIEROWCA: {
    key: "KIEROWCA",
    label: "Kierowca",
    prefix: "K",
    rangeMax: 9999, // 1 do 9999
    description: "Prowadzi pojazdy, realizuje służby i składa raporty",
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  },
};

/**
 * Generuje unikalny numer służbowy dla danej roli zgodnie z wytycznymi:
 * - Kierowca: K + 1..9999 (np. K1923)
 * - Dyspozytor: D + 1..99 (np. D14)
 * - Kierownik Działu Przewozów: P + 1..99 (np. P05)
 * - Mechanik: M + 1..99 (np. M12)
 * - Sprawdzający: S + 1..99 (np. S03)
 * - Właściciel: W + 0..1 (np. W0, W1)
 */
export function generateBadgeNumber(role: string, preferredNum?: number): string {
  const normRole = (role || "KIEROWCA").toUpperCase() as AppRole;
  const info = ROLES[normRole] || ROLES.KIEROWCA;

  if (normRole === "WLASCICIEL" || normRole === "ZARZAD") {
    const num = preferredNum !== undefined ? preferredNum : (Math.random() > 0.5 ? 1 : 0);
    return `W${num}`;
  }

  const num = preferredNum !== undefined ? preferredNum : Math.floor(Math.random() * info.rangeMax) + 1;
  return `${info.prefix}${num}`;
}

export function getRoleLabel(role?: string | null): string {
  if (!role) return "Kierowca";
  const normRole = role.toUpperCase() as AppRole;
  return ROLES[normRole]?.label || role;
}

export function getRoleBadgeClass(role?: string | null): string {
  if (!role) return "bg-slate-500/20 text-slate-300 border-slate-500/50";
  const normRole = role.toUpperCase() as AppRole;
  return ROLES[normRole]?.badgeClass || "bg-slate-500/20 text-slate-300 border-slate-500/50";
}

export function canAccessManagementPanel(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return [
    "WLASCICIEL",
    "ZARZAD",
    "DYSPOZYTOR",
    "KIEROWNIK_PRZEWOZOW",
    "MECHANIK",
    "SPRAWDZAJACY",
  ].includes(normRole);
}

export function canManageDuties(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return ["WLASCICIEL", "ZARZAD", "DYSPOZYTOR"].includes(normRole);
}

export function canManageLines(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return ["WLASCICIEL", "ZARZAD", "KIEROWNIK_PRZEWOZOW"].includes(normRole);
}

export function canManageFleet(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return ["WLASCICIEL", "ZARZAD", "MECHANIK"].includes(normRole);
}

export function canManageRequests(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return ["WLASCICIEL", "ZARZAD", "SPRAWDZAJACY"].includes(normRole);
}

export function canManageUsers(role?: string | null): boolean {
  if (!role) return false;
  const normRole = role.toUpperCase();
  return ["WLASCICIEL", "ZARZAD"].includes(normRole);
}
