// Integracja z Discordem (bez stale działającego procesu - tylko REST + webhooki,
// więc działa na Vercelu). Wszystkie funkcje są "best effort": nigdy nie rzucają wyjątku
// i nie blokują akcji użytkownika, gdy Discord jest niedostępny lub niewłaściwie skonfigurowany.
import { prisma } from "@/lib/prisma";

const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 4000;

export type DiscordChannel = "REKRUTACJA" | "WNIOSKI" | "USTERKI" | "RAPORTY" | "WIADOMOSCI" | "GRAFIK" | "KONTAKT";

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export const COLORS = {
  info: 0x3b82f6,
  ok: 0x10b981,
  warn: 0xf59e0b,
  bad: 0xef4444,
};

function clip(s: string | null | undefined, n: number): string {
  const v = (s ?? "").toString();
  return v.length > n ? v.slice(0, n - 1) + "…" : v;
}

export function embed(e: DiscordEmbed): DiscordEmbed {
  return {
    ...e,
    title: e.title ? clip(e.title, 250) : undefined,
    description: e.description ? clip(e.description, 1800) : undefined,
    fields: e.fields?.slice(0, 10).map((f) => ({ ...f, name: clip(f.name, 250), value: clip(f.value || "-", 1000) })),
    timestamp: e.timestamp ?? new Date().toISOString(),
    footer: e.footer ?? { text: "VZTM Kielce" },
  };
}

async function discordFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    console.error("[discord] fetch error", (err as Error)?.message);
    return null;
  }
}

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/** Webhook kanału: zmienne DISCORD_WEBHOOK_<KANAL>, z awaryjnym DISCORD_WEBHOOK_URL. */
export async function sendToChannel(channel: DiscordChannel, embeds: DiscordEmbed[], content?: string): Promise<boolean> {
  const url = process.env[`DISCORD_WEBHOOK_${channel}`] || process.env.DISCORD_WEBHOOK_URL;
  if (!url || !url.startsWith("https://discord.com/api/webhooks/")) return false;
  const res = await discordFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "VZTM Kielce",
      content: content ? clip(content, 1900) : undefined,
      embeds: embeds.map(embed),
      allowed_mentions: { parse: [] },
    }),
  });
  if (res && !res.ok) console.error("[discord] webhook", channel, res.status);
  return !!res?.ok;
}

/** Wiadomość prywatna (DM) do konta Discord. Wymaga DISCORD_BOT_TOKEN. */
export async function sendDM(discordId: string, embeds: DiscordEmbed[]): Promise<boolean> {
  if (!process.env.DISCORD_BOT_TOKEN || !/^\d{15,25}$/.test(discordId)) return false;
  const ch = await discordFetch(`${API}/users/@me/channels`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!ch || !ch.ok) {
    if (ch) console.error("[discord] open DM", ch.status);
    return false;
  }
  const { id } = (await ch.json()) as { id: string };
  const res = await discordFetch(`${API}/channels/${id}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ embeds: embeds.map(embed), allowed_mentions: { parse: [] } }),
  });
  if (res && !res.ok) console.error("[discord] send DM", res.status); // np. 50007 - użytkownik ma zablokowane DM
  return !!res?.ok;
}

/** DM do użytkownika po id z bazy - tylko jeśli powiązał konto i nie wyłączył powiadomień. */
export async function notifyUser(userId: string, embeds: DiscordEmbed[]): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, discordNotify: true },
    });
    if (!u?.discordId || !u.discordNotify) return false;
    return await sendDM(u.discordId, embeds);
  } catch (err) {
    console.error("[discord] notifyUser", (err as Error)?.message);
    return false;
  }
}

/** DM do wszystkich zaakceptowanych użytkowników z danymi rolami (np. mechanicy przy usterce). */
export async function notifyRoles(roles: string[], embeds: DiscordEmbed[]): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: roles }, status: "ACCEPTED", discordId: { not: null }, discordNotify: true },
      select: { discordId: true },
      take: 25,
    });
    await Promise.all(users.map((u) => sendDM(u.discordId as string, embeds)));
  } catch (err) {
    console.error("[discord] notifyRoles", (err as Error)?.message);
  }
}

/**
 * Uruchamia wysyłkę "w tle" tak, żeby Vercel nie ucinał jej po zwróceniu odpowiedzi.
 * Używa next/server `after`, a gdy niedostępne - czeka na zakończenie.
 */
export async function runAfter(task: () => Promise<unknown>): Promise<void> {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[discord] task error", (err as Error)?.message);
    }
  };
  try {
    const mod = await import("next/server");
    const maybeAfter = (mod as { after?: (fn: () => Promise<void>) => void }).after;
    if (typeof maybeAfter === "function") {
      maybeAfter(safe);
      return;
    }
  } catch {
    // brak `after` - wykonaj od razu
  }
  await safe();
}

// ---------- Synchronizacja ról Discord ----------

export interface DiscordRoleItem {
  id: string;
  name: string;
  position: number;
}

let cachedGuildRoles: { at: number; roles: DiscordRoleItem[] } | null = null;

export async function fetchGuildRoles(): Promise<DiscordRoleItem[]> {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild || !process.env.DISCORD_BOT_TOKEN) return [];
  const now = Date.now();
  if (cachedGuildRoles && now - cachedGuildRoles.at < 60000) {
    return cachedGuildRoles.roles;
  }
  const res = await discordFetch(`${API}/guilds/${guild}/roles`, { headers: botHeaders() });
  if (!res || !res.ok) return cachedGuildRoles?.roles || [];
  try {
    const roles = (await res.json()) as DiscordRoleItem[];
    cachedGuildRoles = { at: now, roles };
    return roles;
  } catch {
    return [];
  }
}

const ROLE_ENV: Record<string, string> = {
  WLASCICIEL: "DISCORD_ROLE_WLASCICIEL",
  ZARZAD: "DISCORD_ROLE_WLASCICIEL",
  DYSPOZYTOR: "DISCORD_ROLE_DYSPOZYTOR",
  KIEROWNIK_PRZEWOZOW: "DISCORD_ROLE_KIEROWNIK",
  MECHANIK: "DISCORD_ROLE_MECHANIK",
  SPRAWDZAJACY: "DISCORD_ROLE_SPRAWDZAJACY",
  KIEROWCA: "DISCORD_ROLE_KIEROWCA",
};

const CARRIER_ENV: Record<string, string> = {
  VMPK: "DISCORD_ROLE_VMPK",
  VBP: "DISCORD_ROLE_VBP",
};

const ROLE_NAMES_MAP: Record<string, string[]> = {
  WLASCICIEL: ["właściciel", "wlasciciel", "zarząd", "zarzad", "head admin", "owner"],
  ZARZAD: ["zarząd", "zarzad", "właściciel", "wlasciciel", "zarządca"],
  DYSPOZYTOR: ["dyspozytor", "dyspozytornia", "dyspozytorzy"],
  KIEROWNIK_PRZEWOZOW: ["kierownik przewozów", "kierownik przewozow", "kierownik działu przewozów", "kierownik dzialu przewozow", "kierownik"],
  MECHANIK: ["mechanik", "serwis", "warsztat"],
  SPRAWDZAJACY: ["sprawdzający", "sprawdzajacy", "weryfikator"],
  KIEROWCA: ["kierowca", "kierowcy", "driver"],
};

const CARRIER_NAMES_MAP: Record<string, string[]> = {
  VMPK: ["vmpk", "vmpk kielce"],
  VBP: ["vbp", "vbp tour regio", "vbp kielce"],
};

export interface SyncRoleResult {
  success: boolean;
  message: string;
  appliedRoles: string[];
}

/** Rozwiązuje ID roli Discord: najpierw po zmiennej środowiskowej (ID lub nazwa), a w razie braku po nazwie na serwerze. */
function resolveDiscordRole(
  envKey: string | undefined,
  fallbackNames: string[],
  guildRoles: DiscordRoleItem[]
): DiscordRoleItem | null {
  const envVal = envKey ? process.env[envKey]?.trim() : undefined;
  if (envVal) {
    const byId = guildRoles.find((r) => r.id === envVal);
    if (byId) return byId;
    const byEnvName = guildRoles.find((r) => r.name.toLowerCase() === envVal.toLowerCase());
    if (byEnvName) return byEnvName;
    if (/^\d{15,25}$/.test(envVal)) return { id: envVal, name: envVal, position: 0 };
  }

  for (const name of fallbackNames) {
    const found = guildRoles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return null;
}

/** Nadaje role Discord zgodnie z rolą i przewoźnikiem w systemie ze szczegółowym raportem. */
export async function syncDiscordRolesDetailed(userId: string): Promise<SyncRoleResult> {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild || !process.env.DISCORD_BOT_TOKEN) {
    return { success: false, message: "Brak konfiguracji bota Discord (ustaw DISCORD_BOT_TOKEN i DISCORD_GUILD_ID w Vercel).", appliedRoles: [] };
  }

  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, role: true, carrier: true, status: true, suspended: true, username: true, badgeNumber: true, discordUsername: true },
    });
    if (!u?.discordId) {
      return { success: false, message: "Konto użytkownika nie jest powiązane z Discordem.", appliedRoles: [] };
    }

    // Pobierz informacje o gildii (m.in. czy użytkownik jest właścicielem serwera)
    const gRes = await discordFetch(`${API}/guilds/${guild}`, { headers: botHeaders() });
    const guildData = gRes?.ok ? ((await gRes.json()) as { owner_id?: string }) : null;
    const isGuildOwner = guildData?.owner_id === u.discordId;

    const guildRoles = await fetchGuildRoles();

    const roleItem = resolveDiscordRole(ROLE_ENV[u.role], ROLE_NAMES_MAP[u.role] || [], guildRoles);
    const carrierItem = u.carrier ? resolveDiscordRole(CARRIER_ENV[u.carrier], CARRIER_NAMES_MAP[u.carrier] || [], guildRoles) : null;

    const mRes = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}`, { headers: botHeaders() });
    if (!mRes) {
      return { success: false, message: "Błąd połączenia z API Discorda.", appliedRoles: [] };
    }
    if (mRes.status === 404) {
      return {
        success: false,
        message: `Użytkownik (${u.username}) nie dołączył do Twojego serwera Discord. Dołącz do serwera, a następnie kliknij synchronizację.`,
        appliedRoles: [],
      };
    }
    if (!mRes.ok) {
      return { success: false, message: `Błąd Discord API: kod ${mRes.status}.`, appliedRoles: [] };
    }

    const member = (await mRes.json()) as {
      roles: string[];
      nick?: string | null;
      user?: { id: string; username: string; global_name?: string | null };
    };
    const currentRoles = new Set(member.roles);
    const applied: string[] = [];

    // Zapisz/zaktualizuj discordUsername w bazie danych
    const freshDiscordName = member.user?.global_name || member.user?.username || member.nick;
    if (freshDiscordName && freshDiscordName !== u.discordUsername) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { discordUsername: freshDiscordName },
        });
      } catch {}
    }

    let nickNotice = "";

    if (u.status === "ACCEPTED" && !u.suspended) {
      // 1. Rola stanowiskowa
      if (roleItem) {
        if (!currentRoles.has(roleItem.id)) {
          const putRes = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${roleItem.id}`, {
            method: "PUT",
            headers: botHeaders(),
          });
          if (putRes && (putRes.status === 204 || putRes.ok)) {
            applied.push(roleItem.name);
          } else if (putRes?.status === 403) {
            console.error(`[discord] 403 Forbidden dla roli ${roleItem.name}: rola bota musi być wyżej niż przypisywana rola na liście ról w Discordzie!`);
          }
        } else {
          applied.push(roleItem.name);
        }
      }

      // 2. Rola przewoźnika (VMPK / VBP)
      if (carrierItem) {
        if (!currentRoles.has(carrierItem.id)) {
          const putRes = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${carrierItem.id}`, {
            method: "PUT",
            headers: botHeaders(),
          });
          if (putRes && (putRes.status === 204 || putRes.ok)) {
            applied.push(carrierItem.name);
          } else if (putRes?.status === 403) {
            console.error(`[discord] 403 Forbidden dla roli przewoźnika ${carrierItem.name}`);
          }
        } else {
          applied.push(carrierItem.name);
        }
      }

      // 3. Usuń inne role funkcyjne z systemu po ewentualnej zmianie roli
      for (const [rKey, envVar] of Object.entries(ROLE_ENV)) {
        if (rKey === u.role || (u.role === "WLASCICIEL" && rKey === "ZARZAD") || (u.role === "ZARZAD" && rKey === "WLASCICIEL")) continue;
        const otherRole = resolveDiscordRole(envVar, ROLE_NAMES_MAP[rKey] || [], guildRoles);
        if (otherRole && currentRoles.has(otherRole.id) && otherRole.id !== roleItem?.id) {
          await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${otherRole.id}`, {
            method: "DELETE",
            headers: botHeaders(),
          });
        }
      }

      // 4. Usuń drugiego przewoźnika jeśli zmieniono
      for (const [cKey, envVar] of Object.entries(CARRIER_ENV)) {
        if (cKey === u.carrier) continue;
        const otherCarrier = resolveDiscordRole(envVar, CARRIER_NAMES_MAP[cKey] || [], guildRoles);
        if (otherCarrier && currentRoles.has(otherCarrier.id) && otherCarrier.id !== carrierItem?.id) {
          await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${otherCarrier.id}`, {
            method: "DELETE",
            headers: botHeaders(),
          });
        }
      }

      // 5. Aktualizacja pseudonimu na serwerze Discord (np. "W1 Jan")
      const effectiveBadge = u.badgeNumber;
      if (effectiveBadge) {
        // Użyj nicku z Discorda jeśli istnieje, inaczej z systemu
        const dcRawName = member.nick || member.user?.global_name || member.user?.username || u.discordUsername || u.username;
        const cleanName = dcRawName.replace(/^\[?[A-Z0-9]+\]?\s*\|?\s*/i, "").trim() || u.username;
        const targetNick = `${effectiveBadge} ${cleanName}`.slice(0, 32);

        if (isGuildOwner) {
          nickNotice = ` (Uwaga: Jesteś Właścicielem serwera Discord – Discord zabrania botom modyfikacji pseudonimu Właściciela Serwera. Ustaw pseudonim "${targetNick}" ręcznie na Discordzie: prawy klik na siebie -> Zmień profil serwera). Dla pozostałych kierowców bot ustawi go automatycznie.`;
        } else {
          try {
            const nickRes = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}`, {
              method: "PATCH",
              headers: { ...botHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify({ nick: targetNick }),
            });
            if (nickRes && nickRes.ok) {
              nickNotice = ` oraz ustawiono pseudonim "${targetNick}".`;
            } else if (nickRes?.status === 403) {
              nickNotice = ` (Uwaga: Bot nie ma uprawnienia "Zarządzanie pseudonimami" / Manage Nicknames lub jego rola na Discordzie jest niżej niż Twoja; ustaw "${targetNick}" ręcznie).`;
            }
          } catch (e) {
            console.error("[discord] Błąd zmiany nicku:", e);
          }
        }
      }
    } else {
      // Konto nieaktywne/zawieszone - usuń zarządzane role
      for (const [rKey, envVar] of Object.entries(ROLE_ENV)) {
        const otherRole = resolveDiscordRole(envVar, ROLE_NAMES_MAP[rKey] || [], guildRoles);
        if (otherRole && currentRoles.has(otherRole.id)) {
          await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${otherRole.id}`, {
            method: "DELETE",
            headers: botHeaders(),
          });
        }
      }
      for (const [cKey, envVar] of Object.entries(CARRIER_ENV)) {
        const otherCarrier = resolveDiscordRole(envVar, CARRIER_NAMES_MAP[cKey] || [], guildRoles);
        if (otherCarrier && currentRoles.has(otherCarrier.id)) {
          await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}/roles/${otherCarrier.id}`, {
            method: "DELETE",
            headers: botHeaders(),
          });
        }
      }
    }

    if (applied.length > 0) {
      return { success: true, message: `Pomyślnie zsynchronizowano role na Discordzie (${applied.join(", ")})${nickNotice}`, appliedRoles: applied };
    }

    return {
      success: true,
      message: `Role użytkownika (${u.role}${u.carrier ? `, ${u.carrier}` : ""}) zostały zaktualizowane na serwerze Discord${nickNotice}`,
      appliedRoles: applied,
    };
  } catch (err) {
    console.error("[discord] syncDiscordRoles error:", (err as Error)?.message);
    return { success: false, message: `Błąd podczas synchronizacji ról: ${(err as Error)?.message}`, appliedRoles: [] };
  }
}

/** Nadaje/zabiera role Discord zgodnie z rolą i przewoźnikiem w systemie. Zwraca true, gdy się udało. */
export async function syncDiscordRoles(userId: string): Promise<boolean> {
  const res = await syncDiscordRolesDetailed(userId);
  return res.success;
}

// ---------- OAuth (logowanie i powiązanie konta) ----------

export function discordOAuthConfigured(): boolean {
  return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

export function siteUrl(req?: Request): string {
  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
      const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  const envUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return envUrl.replace(/\/$/, "");
}
