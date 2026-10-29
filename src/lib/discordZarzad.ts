import {
  canAccessManagementPanel,
  canManageRequests,
  canManageFleet,
  canManageUsers,
} from "./roles.ts";

export const ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export interface ZarzadPermissions {
  canAccess: boolean;
  canRequests: boolean;
  canReports: boolean;
  canFleet: boolean;
  canUsers: boolean;
}

export function getZarzadPermissions(role?: string | null): ZarzadPermissions {
  return {
    canAccess: canAccessManagementPanel(role),
    canRequests: canManageRequests(role),
    canReports: canManageRequests(role),
    canFleet: canManageFleet(role),
    canUsers: canManageUsers(role),
  };
}

export type ZarzadActionType =
  | "menu"
  | "req_list"
  | "req_approve"
  | "req_reject"
  | "rep_list"
  | "rep_approve"
  | "rep_reject"
  | "def_list"
  | "def_repair"
  | "def_fixed"
  | "cand_list"
  | "cand_approve"
  | "cand_reject";

export interface ParsedZarzadCustomId {
  action: ZarzadActionType;
  targetId?: string;
  offset?: number;
}

export function parseZarzadCustomId(customId: string): ParsedZarzadCustomId | null {
  if (!customId.startsWith("zarzad_")) return null;
  const rest = customId.slice("zarzad_".length);

  if (rest === "menu" || rest === "main") {
    return { action: "menu" };
  }

  const colonIndex = rest.indexOf(":");
  if (colonIndex === -1) {
    if (rest === "req_list") return { action: "req_list", offset: 0 };
    if (rest === "rep_list") return { action: "rep_list", offset: 0 };
    if (rest === "def_list") return { action: "def_list", offset: 0 };
    if (rest === "cand_list") return { action: "cand_list", offset: 0 };
    return null;
  }

  const prefix = rest.slice(0, colonIndex);
  const param = rest.slice(colonIndex + 1).trim();

  if (
    prefix === "req_list" ||
    prefix === "rep_list" ||
    prefix === "def_list" ||
    prefix === "cand_list"
  ) {
    const offset = parseInt(param, 10);
    if (!Number.isInteger(offset) || offset < 0) return null;
    return { action: prefix as ZarzadActionType, offset };
  }

  if (
    prefix === "req_approve" ||
    prefix === "req_reject" ||
    prefix === "rep_approve" ||
    prefix === "rep_reject" ||
    prefix === "def_repair" ||
    prefix === "def_fixed" ||
    prefix === "cand_approve" ||
    prefix === "cand_reject"
  ) {
    if (!ID_REGEX.test(param)) return null;
    return { action: prefix as ZarzadActionType, targetId: param };
  }

  return null;
}
