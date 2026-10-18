import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncDiscordRolesDetailed } from "@/lib/discord";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: "Musisz być zalogowany, aby zsynchronizować role." }, { status: 401 });
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
