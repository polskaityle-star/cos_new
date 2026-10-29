import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageUsers } from "@/lib/roles";
import { COLORS, notifyUser, runAfter, syncDiscordRoles } from "@/lib/discord";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !canManageUsers(session.user.role)) {
      return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    const formData = await req.formData();
    const carrier = formData.get("carrier") as string;

    if (!userId || !action) {
      return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ message: "Nieprawidłowa akcja (dozwolone: accept, reject)" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ message: "Użytkownik nie został odnaleziony" }, { status: 404 });
    }

    if (action === "accept") {
      if (!carrier || (carrier !== "VMPK" && carrier !== "VBP")) {
        return NextResponse.json({ message: "Brak lub nieprawidłowy przewoźnik (dozwolone: VMPK, VBP)" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { status: "ACCEPTED", carrier },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { status: "REJECTED" },
      });
    }

    await runAfter(async () => {
      await syncDiscordRoles(userId);
      await notifyUser(userId, [
        action === "accept"
          ? { title: "Konto zaakceptowane", description: `Witamy w VZTM Kielce! Przewoźnik: ${carrier}.`, color: COLORS.ok }
          : { title: "Zgłoszenie odrzucone", description: "Twoje zgłoszenie do VZTM Kielce zostało odrzucone.", color: COLORS.bad },
      ]);
    });

    revalidatePath("/panel/zarzad");
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("AKCEPTACJA ERROR", error);
    return NextResponse.json({ message: "Wystąpił błąd podczas akceptacji użytkownika" }, { status: 500 });
  }

  redirect("/panel/zarzad");
}
