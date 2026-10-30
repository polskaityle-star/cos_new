import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageUsers, generateUniqueBadgeNumber, isValidBadgeNumber, ROLES } from "@/lib/roles";
import { COLORS, notifyUser, runAfter, syncDiscordRoles } from "@/lib/discord";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania użytkownikami" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const newRole = formData.get("role") as string;
  const rawCustomBadge = formData.get("badgeNumber");
  const customBadge = typeof rawCustomBadge === "string" ? rawCustomBadge.trim() : "";

  if (!userId || !newRole) {
    return NextResponse.json({ message: "Brak wymaganych parametrów" }, { status: 400 });
  }

  if (!(newRole in ROLES)) {
    return NextResponse.json({ message: "Nieprawidłowa rola" }, { status: 400 });
  }

  if (session.user.id === userId) {
    return NextResponse.json({ message: "Nie możesz zmienić własnej roli" }, { status: 403 });
  }

  // Wymóg 15: Tylko Właściciel może nadać rolę Właściciela
  if (newRole === "WLASCICIEL" && session.user.role !== "WLASCICIEL") {
    return NextResponse.json({ message: "Tylko Właściciel może nadawać rolę Właściciela" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ message: "Użytkownik nie istnieje" }, { status: 404 });
  }

  if (user.role === "WLASCICIEL" && session.user.role !== "WLASCICIEL") {
    return NextResponse.json({ message: "Tylko Właściciel może modyfikować konto Właściciela" }, { status: 403 });
  }

  // Wymóg 16: Walidacja customBadge lub zachowanie generowania przy zmianie roli
  let finalBadge: string;
  if (customBadge) {
    if (!isValidBadgeNumber(customBadge)) {
      return NextResponse.json({ message: "Nieprawidłowy format numeru służbowego" }, { status: 400 });
    }
    const normalizedBadge = customBadge.toUpperCase();
    const existingWithBadge = await prisma.user.findFirst({
      where: {
        badgeNumber: normalizedBadge,
        NOT: { id: userId },
      },
    });
    if (existingWithBadge) {
      return NextResponse.json({ message: "Podany numer służbowy jest już zajęty" }, { status: 409 });
    }
    finalBadge = normalizedBadge;
  } else if (!user.badgeNumber || user.role !== newRole) {
    finalBadge = await generateUniqueBadgeNumber(newRole, prisma);
  } else {
    finalBadge = user.badgeNumber;
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
