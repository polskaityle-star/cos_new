import { prisma } from "./prisma";
import { generateUniqueBadgeNumber } from "./roles";
import { COLORS, notifyUser, runAfter, syncDiscordRoles } from "./discord";

export interface ReviewCandidateOptions {
  userId: string;
  action: "accept" | "reject";
  carrier?: string;
  reviewerId?: string;
  reviewerRole?: string;
}

export interface ReviewCandidateResult {
  ok: boolean;
  status: number;
  message: string;
  user?: {
    id?: string;
    username?: string;
    role?: string;
    carrier?: string | null;
    badgeNumber?: string | null;
  } | null;
}

export async function reviewCandidate(options: ReviewCandidateOptions): Promise<ReviewCandidateResult> {
  const { userId, action, carrier, reviewerId } = options;

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return { ok: false, status: 404, message: "Użytkownik nie został odnaleziony" };
  }

  if (existingUser.status !== "PENDING") {
    return { ok: false, status: 409, message: "Kandydat został już rozpatrzony" };
  }

  console.info(`[reviewCandidate] userId=${userId} reviewerId=${reviewerId ?? "unknown"} action=${action}`);

  const isAccepted = action === "accept";
  let finalCarrier = carrier;

  if (isAccepted) {
    finalCarrier = carrier || existingUser.carrier || undefined;
    if (!finalCarrier || (finalCarrier !== "VMPK" && finalCarrier !== "VBP")) {
      return { ok: false, status: 400, message: "Brak lub nieprawidłowy przewoźnik (dozwolone: VMPK, VBP)" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updateRes = await tx.user.updateMany({
        where: { id: userId, status: "PENDING" },
        data: { status: isAccepted ? "ACCEPTED" : "REJECTED" },
      });

      if (updateRes.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      if (isAccepted) {
        const badgeNumber = existingUser.badgeNumber || (await generateUniqueBadgeNumber(existingUser.role, tx));
        await tx.user.update({
          where: { id: userId },
          data: {
            carrier: finalCarrier,
            badgeNumber,
          },
        });
      }
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { ok: false, status: 409, message: "Kandydat został już rozpatrzony" };
    }
    console.error("[reviewCandidate error]:", err);
    return { ok: false, status: 500, message: "Wystąpił błąd podczas rozpatrywania kandydata" };
  }

  await runAfter(async () => {
    await syncDiscordRoles(userId);
    await notifyUser(userId, [
      isAccepted
        ? { title: "Konto zaakceptowane", description: `Witamy w VZTM Kielce! Przewoźnik: ${finalCarrier}.`, color: COLORS.ok }
        : { title: "Zgłoszenie odrzucone", description: "Twoje zgłoszenie do VZTM Kielce zostało odrzucone.", color: COLORS.bad },
    ]);
  });

  return {
    ok: true,
    status: 200,
    message: isAccepted ? "Kandydat zaakceptowany" : "Kandydat odrzucony",
    user: existingUser,
  };
}
