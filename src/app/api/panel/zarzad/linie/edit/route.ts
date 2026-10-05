import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ZARZAD") {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;
  const number = formData.get("number") as string;
  const startStop = formData.get("startStop") as string;
  const endStop = formData.get("endStop") as string;
  const directions = formData.get("directions") as string;
  const brigades = formData.get("brigades") as string;

  if (id && number) {
    const updateData: any = {
      number,
      directions: directions || null,
      brigades: brigades || null,
    };
    if (startStop !== undefined && startStop !== null) updateData.startStop = startStop;
    if (endStop !== undefined && endStop !== null) updateData.endStop = endStop;

    await prisma.line.update({
      where: { id },
      data: updateData
    });
    revalidatePath("/linie");
    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
