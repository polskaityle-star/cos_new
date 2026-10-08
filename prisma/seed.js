const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Password hashes
  const adminPassword = await bcrypt.hash("admin123", 10);
  const driverPassword = await bcrypt.hash("kierowca123", 10);

  // 1. Zarząd: Godksawiss (usunięcie administratora i starego admina)
  await prisma.user.deleteMany({
    where: {
      username: { in: ["administrator", "Administrator", "admin", "Admin"] },
    },
  });

  await prisma.user.upsert({
    where: { username: "Godksawiss" },
    update: {
      password: adminPassword,
      role: "ZARZAD",
      status: "ACCEPTED",
      carrier: "VMPK"
    },
    create: {
      username: "Godksawiss",
      password: adminPassword,
      role: "ZARZAD",
      status: "ACCEPTED",
      carrier: "VMPK"
    }
  });

  // 2. Driver
  const driver = await prisma.user.upsert({
    where: { username: "kierowca1" },
    update: {
      password: driverPassword,
      role: "KIEROWCA",
      status: "ACCEPTED",
      carrier: "VMPK"
    },
    create: {
      username: "kierowca1",
      password: driverPassword,
      role: "KIEROWCA",
      status: "ACCEPTED",
      carrier: "VMPK"
    }
  });

  // 3. Lines
  const lineCount = await prisma.line.count();
  let line34;
  if (lineCount === 0) {
    line34 = await prisma.line.create({
      data: { number: "34", startStop: "Bukówka", endStop: "Wichrowa" }
    });
    await prisma.line.create({
      data: { number: "46", startStop: "Ślichowice", endStop: "Świętokrzyska" }
    });
    await prisma.line.create({
      data: { number: "102", startStop: "Dworzec PKP", endStop: "Targi Kielce" }
    });
  } else {
    line34 = await prisma.line.findFirst({ where: { number: "34" } });
  }

  // 4. Vehicles
  const vehicleCount = await prisma.vehicle.count();
  if (vehicleCount === 0) {
    await prisma.vehicle.createMany({
      data: [
        { carrier: "VMPK", model: "Solaris Urbino 12 IV", registration: "TK 12345", fleetNumber: "#101" },
        { carrier: "VMPK", model: "Solaris Urbino 18 IV", registration: "TK 67890", fleetNumber: "#102" },
        { carrier: "VBP", model: "MAN Lion's City 12C", registration: "TK 54321", fleetNumber: "#201" },
        { carrier: "VBP", model: "Mercedes-Benz Conecto G", registration: "TK 98765", fleetNumber: "#202" },
      ]
    });
  }

  // 5. Example scheduled duty for kierowca1 if none exists
  if (line34 && driver) {
    const existingDuty = await prisma.duty.findFirst({
      where: { userId: driver.id }
    });
    if (!existingDuty) {
      await prisma.duty.create({
        data: {
          userId: driver.id,
          lineId: line34.id,
          date: new Date(),
          brigade: "34/1 - dni robocze",
          status: "SCHEDULED"
        }
      });
    } else {
      await prisma.duty.update({
        where: { id: existingDuty.id },
        data: { brigade: "34/1 - dni robocze" }
      });
    }
  }

  // 6. Brigade schedules
  if (line34) {
    await prisma.line.update({
      where: { id: line34.id },
      data: {
        directions: "Wariant A: Bukówka - Czarnowska - Wichrowa | Wariant B: Bukówka - Seminaryjska - Wichrowa",
        brigades: "34/1, 34/2, 34/3"
      }
    });

    const bCount = await prisma.brigadeSchedule.count({ where: { lineId: line34.id } });
    if (bCount === 0) {
      await prisma.brigadeSchedule.createMany({
        data: [
          {
            lineId: line34.id,
            brigadeNumber: "34/1",
            startTime: "05:15",
            endTime: "13:45",
            startLocation: "Zajezdnia VMPK / Bukówka",
            endLocation: "Bukówka / Zajezdnia VMPK",
            driverChanges: "Przesiadka na przystanku Żytnia I o 09:30 z kierowcą zm. B",
            notes: "Kurs zjazdowy przez ul. Seminaryjską"
          },
          {
            lineId: line34.id,
            brigadeNumber: "34/2",
            startTime: "06:00",
            endTime: "14:30",
            startLocation: "Wichrowa",
            endLocation: "Wichrowa",
            driverChanges: "Podmiana kierowcy na pętli Bukówka o 10:15",
            notes: "Obsługa autobusem przegubowym 18m"
          }
        ]
      });
    }
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seed warning:", e.message);
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
