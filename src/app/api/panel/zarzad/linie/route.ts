import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageLines } from "@/lib/roles";

const ALLOWED_CARRIERS = ["VMPK", "VBP"];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageLines(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania liniami" }, { status: 403 });
  }

  const formData = await req.formData();
  const rawNumber = formData.get("number");
  const number = typeof rawNumber === "string" ? rawNumber.trim() : "";
  const rawCarrier = formData.get("carrier");
  const carrier = typeof rawCarrier === "string" ? rawCarrier.trim() : "";
  const rawStartStop = formData.get("startStop");
  const startStop = typeof rawStartStop === "string" ? rawStartStop.trim() : "";
  const rawEndStop = formData.get("endStop");
  const endStop = typeof rawEndStop === "string" ? rawEndStop.trim() : "";
  const rawDirections = formData.get("directions");
  const directions = typeof rawDirections === "string" ? rawDirections.trim() : null;
  const rawBrigades = formData.get("brigades");
  const brigades = typeof rawBrigades === "string" ? rawBrigades.trim() : null;

  if (!number || number.length > 10) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "invalid_line_number");
    return NextResponse.redirect(url, 303);
  }

  let finalCarrier: string | null = null;
  if (carrier) {
    if (!ALLOWED_CARRIERS.includes(carrier)) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "invalid_carrier");
      return NextResponse.redirect(url, 303);
    }
    finalCarrier = carrier;
  }

  const existing = await prisma.line.findFirst({
    where: { number },
  });
  if (existing) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "line_exists");
    return NextResponse.redirect(url, 303);
  }

  try {
    await prisma.line.create({
      data: {
        number,
        carrier: finalCarrier,
        startStop: startStop || "",
        endStop: endStop || "",
        directions: directions || null,
        brigades: brigades || null,
      },
    });
    revalidatePath("/linie");
    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "line_exists");
      return NextResponse.redirect(url, 303);
    }
    throw err;
  }

  redirect("/panel/zarzad");
}
