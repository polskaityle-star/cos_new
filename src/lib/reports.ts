import { prisma } from "./prisma";
import { COLORS, notifyUser, runAfter } from "./discord";

export interface ReviewReportOptions {
  reportId: string;
  action: "accept" | "reject";
  rejectReason?: string;
  reviewerId?: string;
  reviewerRole?: string;
}

export interface ReviewReportResult {
  ok: boolean;
  status: number;
  message: string;
  report?: unknown;
}

export async function reviewReport(options: ReviewReportOptions): Promise<ReviewReportResult> {
  const { reportId, action, reviewerId, reviewerRole } = options;

  const existingReport = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      duty: {
        include: {
          line: true,
          replacementVehicle: true,
          vehicle: true,
        },
      },
    },
  });

  if (!existingReport) {
    return { ok: false, status: 404, message: "Raport nie istnieje" };
  }

  if (existingReport.status !== "PENDING") {
    return { ok: false, status: 409, message: "Raport został już rozpatrzony" };
  }

  // Blokada samozatwierdzania (z wyjątkiem roli WLASCICIEL)
  if (reviewerId && existingReport.duty?.userId === reviewerId && reviewerRole !== "WLASCICIEL") {
    return { ok: false, status: 403, message: "Nie możesz rozpatrywać własnego raportu" };
  }

  // Ślad decyzji (schema nie posiada pól reviewedBy/reviewedAt)
  console.info(`[reviewReport] reportId=${reportId} reviewerId=${reviewerId ?? "unknown"} action=${action}`);

  const isAccepted = action === "accept";
  const newStatus = isAccepted ? "ACCEPTED" : "REJECTED";

  try {
    await prisma.$transaction(async (tx) => {
      const updateRes = await tx.report.updateMany({
        where: { id: reportId, status: "PENDING" },
        data: { status: newStatus },
      });

      if (updateRes.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      if (isAccepted) {
        const targetVehicleId = existingReport.duty?.replacementVehicleId ?? existingReport.duty?.vehicleId;
        const distance = existingReport.endMileage - existingReport.startMileage;

        if (
          targetVehicleId &&
          distance >= 0 &&
          distance <= 2000 &&
          existingReport.endMileage <= 2_000_000_000
        ) {
          await tx.vehicle.updateMany({
            where: {
              id: targetVehicleId,
              mileage: { lt: existingReport.endMileage },
            },
            data: {
              mileage: existingReport.endMileage,
            },
          });
        }
      }
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { ok: false, status: 409, message: "Raport został już rozpatrzony" };
    }
    console.error("[reviewReport error]:", err);
    return { ok: false, status: 500, message: "Wystąpił błąd podczas rozpatrywania raportu" };
  }

  if (existingReport.duty) {
    await runAfter(() =>
      notifyUser(existingReport.duty.userId, [
        {
          title: isAccepted ? "Raport zaakceptowany" : "Raport odrzucony",
          color: isAccepted ? COLORS.ok : COLORS.bad,
          description: `Służba z ${existingReport.duty.date.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}, linia ${existingReport.duty.line?.number ?? "-"}.`,
        },
      ])
    );
  }

  return {
    ok: true,
    status: 200,
    message: isAccepted ? "Raport zaakceptowany" : "Raport odrzucony",
    report: existingReport,
  };
}
