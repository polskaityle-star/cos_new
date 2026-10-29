import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/roles";
import { syncDiscordRoles } from "@/lib/discord";

export const maxDuration = 60;

// Ręczna synchronizacja ról Discord dla powiązanych kont (paginacja po 100 użytkowników).
export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => null);
  const cursor = (typeof body?.cursor === "string" ? body.cursor : null) || url.searchParams.get("cursor") || undefined;

  const take = 100;
  const users = await prisma.user.findMany({
    where: { discordId: { not: null } },
    select: { id: true },
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    orderBy: { id: "asc" },
  });

  const hasMore = users.length > take;
  const batch = hasMore ? users.slice(0, take) : users;
  const nextCursor = hasMore && batch.length > 0 ? batch[batch.length - 1].id : null;

  let ok = 0;
  for (const u of batch) {
    if (await syncDiscordRoles(u.id)) ok++;
    await new Promise((r) => setTimeout(r, 120)); // łagodnie wobec limitów API Discorda
  }

  return NextResponse.json({
    total: batch.length,
    synced: ok,
    hasMore,
    nextCursor,
  });
}
