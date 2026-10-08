import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageLines } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !canManageLines(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania liniami" }, { status: 403 });
  }

  const formData = await req.formData();
  const number = formData.get("number") as string;
  const carrier = (formData.get("carrier") as string) || null;
  const startStop = formData.get("startStop") as string;
  const endStop = formData.get("endStop") as string;
  const directions = formData.get("directions") as string;
  const brigades = formData.get("brigades") as string;

  if (number) {
    await prisma.line.create({
      data: {
        number,
        carrier: carrier || null,
        startStop: startStop || "",
        endStop: endStop || "",
        directions: directions || null,
        brigades: brigades || null,
      }
    });
    revalidatePath("/linie");
    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
