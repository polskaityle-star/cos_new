import { prisma } from "./prisma";
import { generateUniqueBadgeNumber } from "./roles";
import { COLORS, notifyUser, runAfter, syncDiscordRoles } from "./discord";

export interface ReviewCandidateOptions {
  userId: string;
  action: "accept" | "reject";
  carrier?: string;
}

export interface ReviewCandidateResult {
  ok: boolean;
  status: number;
  message: string;
  user?: unknown;
}

export async function reviewCandidate(options: ReviewCandidateOptions): Promise<ReviewCandidateResult> {
  const { userId, action, carrier } = options;

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return { ok: false, status: 404, message: "Użytkownik nie został odnaleziony" };
  }

  if (existingUser.status !== "PENDING") {
    return { ok: false, status: 409, message: "Kandydat został już rozpatrzony" };
  }

  let finalCarrier = carrier;
  let updatedUser;

  if (action === "accept") {
    finalCarrier = carrier || existingUser.carrier || "VMPK";
    if (finalCarrier !== "VMPK" && finalCarrier !== "VBP") {
      return { ok: false, status: 400, message: "Brak lub nieprawidłowy przewoźnik (dozwolone: VMPK, VBP)" };
    }

    const badgeNumber = existingUser.badgeNumber || (await generateUniqueBadgeNumber(existingUser.role, prisma));

    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: "ACCEPTED", carrier: finalCarrier, badgeNumber },
    });
  } else {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: "REJECTED" },
    });
  }

  await runAfter(async () => {
    await syncDiscordRoles(userId);
    await notifyUser(userId, [
      action === "accept"
        ? { title: "Konto zaakceptowane", description: `Witamy w VZTM Kielce! Przewoźnik: ${finalCarrier}.`, color: COLORS.ok }
        : { title: "Zgłoszenie odrzucone", description: "Twoje zgłoszenie do VZTM Kielce zostało odrzucone.", color: COLORS.bad },
    ]);
  });

  return {
    ok: true,
    status: 200,
    message: action === "accept" ? "Kandydat zaakceptowany" : "Kandydat odrzucony",
    user: updatedUser,
  };
}
