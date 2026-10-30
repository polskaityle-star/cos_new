import { prisma } from "./prisma";
import { COLORS, notifyUser, runAfter } from "./discord";

export interface ReviewRequestOptions {
  requestId: string;
  action: "accept" | "reject";
  rejectReason?: string;
  reviewerId?: string;
  reviewerRole?: string;
}

export interface ReviewRequestResult {
  ok: boolean;
  status: number;
  message: string;
  request?: unknown;
}

export async function reviewRequest(options: ReviewRequestOptions): Promise<ReviewRequestResult> {
  const { requestId, action, rejectReason, reviewerId, reviewerRole } = options;

  const driverReq = await prisma.driverRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });

  if (!driverReq) {
    return { ok: false, status: 404, message: "Wniosek nie istnieje" };
  }

  if (driverReq.status !== "PENDING") {
    return { ok: false, status: 409, message: "Wniosek został już rozpatrzony" };
  }

  // Blokada samozatwierdzania (z wyjątkiem roli WLASCICIEL)
  if (reviewerId && driverReq.userId === reviewerId && reviewerRole !== "WLASCICIEL") {
    return { ok: false, status: 403, message: "Nie możesz rozpatrywać własnego wniosku" };
  }

  // Ślad decyzji
  console.info(`[reviewRequest] requestId=${requestId} reviewerId=${reviewerId ?? "unknown"} action=${action}`);

  const accepted = action === "accept";

  if (accepted) {
    // Sprawdzenie dla stałego pojazdu / zmiany stałego pojazdu
    if (driverReq.type === "STALY_POJAZD" || driverReq.type === "ZMIANA_STALEGO_POJAZDU") {
      if (!driverReq.details) {
        return { ok: false, status: 400, message: "Brak wskazanego pojazdu" };
      }
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: driverReq.details },
      });
      if (!vehicle) {
        return { ok: false, status: 404, message: "Pojazd nie istnieje" };
      }
      if (vehicle.status !== "SPRAWNY") {
        return { ok: false, status: 400, message: "Pojazd nie ma statusu SPRAWNY" };
      }
      const driver = await prisma.user.findUnique({
        where: { id: driverReq.userId },
        select: { carrier: true },
      });
      if (driver?.carrier && vehicle.carrier && vehicle.carrier !== driver.carrier) {
        return { ok: false, status: 400, message: "Pojazd nie pasuje do przewoźnika kierowcy" };
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updateRes = await tx.driverRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: accepted ? "ACCEPTED" : "REJECTED",
          responseNotes: accepted ? undefined : (rejectReason || "Wniosek odrzucony przez Zarząd"),
        },
      });

      if (updateRes.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      if (accepted) {
        // 1. Jeśli to wniosek o stały pojazd lub zmianę stałego pojazdu, przypisujemy pojazd kierowcy
        if ((driverReq.type === "STALY_POJAZD" || driverReq.type === "ZMIANA_STALEGO_POJAZDU") && driverReq.details) {
          await tx.user.update({
            where: { id: driverReq.userId },
            data: { assignedVehicleId: driverReq.details },
          });
        }

        // 1.1 Jeśli to wniosek o usunięcie stałego pojazdu (rezygnacja), czyścimy przypisany pojazd
        if (driverReq.type === "USUNIECIE_STALEGO_POJAZDU") {
          await tx.user.update({
            where: { id: driverReq.userId },
            data: { assignedVehicleId: null },
          });
        }

        // 2. Jeśli to wniosek o zmianę etatu, aktualizujemy dni pracy
        if (driverReq.type === "ZMIANA_ETATU" && driverReq.details) {
          await tx.user.update({
            where: { id: driverReq.userId },
            data: { workingDays: driverReq.details },
          });
        }

        // 2.1 Jeśli to wniosek o odwieszenie konta, odblokowujemy kierowcę
        if (driverReq.type === "ODWIESZENIE") {
          await tx.user.update({
            where: { id: driverReq.userId },
            data: { suspended: false },
          });
        }

        // 3. Jeśli to było anulowanie służby i podano ID służby, usuwamy służbę z grafiku
        if (driverReq.type === "ANULOWANIE_SLUZBY" && driverReq.dutyId) {
          await tx.duty.deleteMany({
            where: { id: driverReq.dutyId },
          });
        }
      }
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { ok: false, status: 409, message: "Wniosek został już rozpatrzony" };
    }
    console.error("[reviewRequest error]:", err);
    return { ok: false, status: 500, message: "Wystąpił błąd podczas rozpatrywania wniosku" };
  }

  // Powiadomienie kierowcy na Discordzie
  await runAfter(() =>
    notifyUser(driverReq.userId, [
      {
        title: accepted ? `Wniosek zaakceptowany: ${driverReq.type}` : `Wniosek odrzucony: ${driverReq.type}`,
        color: accepted ? COLORS.ok : COLORS.bad,
        description: accepted ? driverReq.reason || undefined : rejectReason || "Wniosek odrzucony przez Zarząd",
      },
    ])
  );

  return {
    ok: true,
    status: 200,
    message: accepted ? "Wniosek zaakceptowany" : "Wniosek odrzucony",
    request: driverReq,
  };
}
