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
    const { after } = await import("next/server");
    after(safe);
    return;
  } catch {
    // brak kontekstu żądania dla `after` - wykonaj od razu
  }
  await safe();
}

// ---------- Synchronizacja ról Discord ----------

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

function managedRoleIds(): string[] {
  const ids = [...Object.values(ROLE_ENV), ...Object.values(CARRIER_ENV)]
    .map((k) => process.env[k])
    .filter((v): v is string => !!v);
  return Array.from(new Set(ids));
}

/** Nadaje/zabiera role Discord zgodnie z rolą i przewoźnikiem w systemie. Zwraca true, gdy się udało. */
export async function syncDiscordRoles(userId: string): Promise<boolean> {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild || !process.env.DISCORD_BOT_TOKEN) return false;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, role: true, carrier: true, status: true, suspended: true },
    });
    if (!u?.discordId) return false;

    const wanted = new Set<string>();
    if (u.status === "ACCEPTED" && !u.suspended) {
      const roleId = process.env[ROLE_ENV[u.role] ?? ""];
      if (roleId) wanted.add(roleId);
      const carrierId = process.env[CARRIER_ENV[u.carrier ?? ""] ?? ""];
      if (carrierId) wanted.add(carrierId);
    }

    const mRes = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}`, { headers: botHeaders() });
    if (!mRes || !mRes.ok) return false; // użytkownik nie jest na serwerze lub brak uprawnień bota
    const member = (await mRes.json()) as { roles: string[] };
    const current = new Set(member.roles);
    const managed = managedRoleIds();

    const finalRoles = new Set([...current].filter((r) => !managed.includes(r)));
    wanted.forEach((r) => finalRoles.add(r));

    const same = finalRoles.size === current.size && [...finalRoles].every((r) => current.has(r));
    if (same) return true;

    const res = await discordFetch(`${API}/guilds/${guild}/members/${u.discordId}`, {
      method: "PATCH",
      headers: botHeaders(),
      body: JSON.stringify({ roles: [...finalRoles] }),
    });
    if (res && !res.ok) console.error("[discord] role sync", res.status);
    return !!res?.ok;
  } catch (err) {
    console.error("[discord] syncDiscordRoles", (err as Error)?.message);
    return false;
  }
}

// ---------- OAuth (logowanie i powiązanie konta) ----------

export function discordOAuthConfigured(): boolean {
  return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

export function siteUrl(): string {
  return (process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");
}
