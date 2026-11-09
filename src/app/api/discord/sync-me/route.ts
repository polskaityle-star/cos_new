import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncDiscordRolesDetailed } from "@/lib/discord";
import { rateLimit } from "@/lib/rateLimit";

const SYNC_WINDOW_MS = 10 * 60 * 1000; // 10 minut

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: "Musisz być zalogowany, aby zsynchronizować role." }, { status: 401 });
  }

  const limitKey = `discord:sync-me:${session.user.id}`;
  if (!rateLimit(limitKey, 3, SYNC_WINDOW_MS)) {
    return NextResponse.json(
      { message: "Zbyt wiele prób synchronizacji. Dozwolone maksymalnie 3 wywołania na 10 minut. Spróbuj ponownie później." },
      { status: 429 }
    );
  }

  const result = await syncDiscordRolesDetailed(session.user.id);
  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    roles: result.appliedRoles,
  });
}
