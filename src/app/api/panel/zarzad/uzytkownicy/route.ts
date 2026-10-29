import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageUsers, generateUniqueBadgeNumber, ROLES } from "@/lib/roles";
import { COLORS, notifyUser, runAfter, syncDiscordRoles } from "@/lib/discord";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania użytkownikami" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const newRole = formData.get("role") as string;
  const customBadge = formData.get("badgeNumber") as string;

  if (!userId || !newRole) {
    return NextResponse.json({ message: "Brak wymaganych parametrów" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ message: "Użytkownik nie istnieje" }, { status: 404 });
  }

  // Jeśli nie podano customowego numeru, albo jeśli rola się zmieniła, generujemy numer dla nowej roli
  let finalBadge = customBadge?.trim();
  if (!finalBadge || user.role !== newRole) {
    finalBadge = await generateUniqueBadgeNumber(newRole, prisma);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: newRole,
      badgeNumber: finalBadge,
    },
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  if (user.role !== newRole) {
    await runAfter(async () => {
      await syncDiscordRoles(userId);
      await notifyUser(userId, [
        { title: "Zmiana roli w systemie", description: `Twoja nowa rola: ${newRole} (numer ${finalBadge}).`, color: COLORS.info },
      ]);
    });
  }

  redirect("/panel/zarzad");
}
