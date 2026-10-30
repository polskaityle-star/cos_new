import { prisma } from "./prisma.ts";
import { Prisma } from "@prisma/client";

export type DefectStatus = "NOWE" | "WARSZTAT" | "NAPRAWIONE" | "ODRZUCONE";

export interface DefectTransitionCheck {
  valid: boolean;
  status: number;
  message?: string;
}

/**
 * Czysta funkcja sprawdzająca dozwolone przejścia statusów usterek.
 * - Z "NOWE": tylko "WARSZTAT" lub "ODRZUCONE"
 * - Z "WARSZTAT": tylko "NAPRAWIONE" lub "ODRZUCONE"
 * - Przejście do tego samego statusu: 409 "usterka ma już ten status"
 * - Każde inne przejście (w tym z "NAPRAWIONE" lub "ODRZUCONE"): 400 "niedozwolona zmiana statusu usterki"
 */
export function validateDefectTransition(currentStatus: string, newStatus: string): DefectTransitionCheck {
  if (currentStatus === newStatus) {
    return { valid: false, status: 409, message: "usterka ma już ten status" };
  }

  const allowedTransitions: Record<string, string[]> = {
    NOWE: ["WARSZTAT", "ODRZUCONE"],
    WARSZTAT: ["NAPRAWIONE", "ODRZUCONE"],
  };

  const nextAllowed = allowedTransitions[currentStatus];
  if (!nextAllowed || !nextAllowed.includes(newStatus)) {
    return { valid: false, status: 400, message: "niedozwolona zmiana statusu usterki" };
  }

  return { valid: true, status: 200 };
}

export function isAllowedDefectTransition(currentStatus: string, newStatus: string): boolean {
  return validateDefectTransition(currentStatus, newStatus).valid;
}

export interface ReviewDefectOptions {
  defectId: string;
  status: DefectStatus;
  defectType?: string;
  workshopStart?: Date;
  workshopEnd?: Date;
  adminNotes?: string;
  reviewerId?: string;
}

export interface ReviewDefectResult {
  ok: boolean;
  status: number;
  message: string;
  defect?: unknown;
}

export async function reviewDefect(options: ReviewDefectOptions): Promise<ReviewDefectResult> {
  const { defectId, status, defectType, workshopStart, workshopEnd, adminNotes, reviewerId } = options;

  const existingDefect = await prisma.vehicleDefect.findUnique({
    where: { id: defectId },
  });

  if (!existingDefect) {
    return { ok: false, status: 404, message: "Usterka nie istnieje" };
  }

  const transitionCheck = validateDefectTransition(existingDefect.status, status);
  if (!transitionCheck.valid) {
    return {
      ok: false,
      status: transitionCheck.status,
      message: transitionCheck.message || "niedozwolona zmiana statusu usterki",
    };
  }

  console.info(
    `[reviewDefect] defectId=${defectId} reviewerId=${reviewerId ?? "unknown"} from=${existingDefect.status} to=${status}`
  );

  const updateData: Prisma.VehicleDefectUpdateInput = {
    status,
  };

  if (defectType !== undefined) updateData.defectType = defectType;
  if (workshopStart !== undefined) updateData.workshopStart = workshopStart;
  if (workshopEnd !== undefined) updateData.workshopEnd = workshopEnd;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const updateRes = await tx.vehicleDefect.updateMany({
        where: { id: defectId, status: existingDefect.status },
        data: updateData,
      });

      if (updateRes.count !== 1) {
        throw new Error("ALREADY_PROCESSED");
      }

      // Aktualizacja statusu pojazdu
      if (status === "NAPRAWIONE" || status === "ODRZUCONE") {
        const activeDefects = await tx.vehicleDefect.count({
          where: {
            vehicleId: existingDefect.vehicleId,
            status: { in: ["NOWE", "WARSZTAT"] },
          },
        });

        if (activeDefects === 0) {
          await tx.vehicle.update({
            where: { id: existingDefect.vehicleId },
            data: { status: "SPRAWNY" },
          });
        }
      } else if (status === "WARSZTAT") {
        await tx.vehicle.update({
          where: { id: existingDefect.vehicleId },
          data: { status: "WARSZTAT" },
        });
      }

      return await tx.vehicleDefect.findUnique({ where: { id: defectId } });
    });

    return {
      ok: true,
      status: 200,
      message:
        status === "WARSZTAT"
          ? "Usterka skierowana do warsztatu"
          : status === "NAPRAWIONE"
            ? "Usterka oznaczona jako naprawiona"
            : status === "ODRZUCONE"
              ? "Usterka odrzucona"
              : "Status usterki zaktualizowany",
      defect: updated,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { ok: false, status: 409, message: "usterka ma już ten status" };
    }
    console.error("[reviewDefect error]:", err);
    return { ok: false, status: 500, message: "Wystąpił błąd podczas aktualizacji usterki" };
  }
}
