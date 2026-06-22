import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

/** Deterministic UUIDs so seed is idempotent across runs. */
const SEED = {
  inst1: "11111111-1111-4111-8111-111111111101",
  inst2: "11111111-1111-4111-8111-111111111102",
  inst3: "11111111-1111-4111-8111-111111111103",
  inst4: "11111111-1111-4111-8111-111111111104",
  inst5: "11111111-1111-4111-8111-111111111105",
  demand1: "22222222-2222-4222-8222-222222222201",
  demand2: "22222222-2222-4222-8222-222222222202",
  demand3: "22222222-2222-4222-8222-222222222203",
} as const;

const DISTRICTS: { name: string; code: string; hq: string }[] = [
  { name: "Srikakulam", code: "SKL", hq: "Srikakulam" },
  { name: "Parvathipuram Manyam", code: "PVM", hq: "Parvathipuram" },
  { name: "Vizianagaram", code: "VZM", hq: "Vizianagaram" },
  { name: "Alluri Sitharama Raju", code: "ASR", hq: "Paderu" },
  { name: "Visakhapatnam", code: "VSP", hq: "Visakhapatnam" },
  { name: "Anakapalli", code: "ANK", hq: "Anakapalli" },
  { name: "East Godavari", code: "EGV", hq: "Rajamahendravaram" },
  { name: "Dr. B. R. Ambedkar Konaseema", code: "KSM", hq: "Amalapuram" },
  { name: "Kakinada", code: "KKD", hq: "Kakinada" },
  { name: "West Godavari", code: "WGD", hq: "Bhimavaram" },
  { name: "Eluru", code: "ELU", hq: "Eluru" },
  { name: "NTR", code: "NTR", hq: "Vijayawada" },
  { name: "Krishna", code: "KRS", hq: "Machilipatnam" },
  { name: "Guntur", code: "GNT", hq: "Guntur" },
  { name: "Bapatla", code: "BPT", hq: "Bapatla" },
  { name: "Palnadu", code: "PLN", hq: "Narasaraopet" },
  { name: "Prakasam", code: "PKM", hq: "Ongole" },
  { name: "Sri Potti Sriramulu Nellore", code: "NLR", hq: "Nellore" },
  { name: "Annamayya", code: "ANN", hq: "Madanapalle" },
  { name: "Sri Sathya Sai", code: "SSS", hq: "Puttaparthi" },
  { name: "Tirupati", code: "TPT", hq: "Tirupati" },
  { name: "Chittoor", code: "CTR", hq: "Chittoor" },
  { name: "YSR Kadapa", code: "KDP", hq: "Kadapa" },
  { name: "Ananthapuramu", code: "ATP", hq: "Anantapuram" },
  { name: "Kurnool", code: "KNL", hq: "Kurnool" },
  { name: "Nandyal", code: "NDL", hq: "Nandyal" },
];

async function main() {
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { code: d.code },
      update: { name: d.name, hqCity: d.hq },
      create: { name: d.name, code: d.code, hqCity: d.hq },
    });
  }

  const guntur = await prisma.district.findUniqueOrThrow({
    where: { code: "GNT" },
  });

  const hash = async (password: string) =>
    bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { phone: "9000000001" },
    update: {
      name: "Seed Admin",
      password: await hash("Admin@123"),
      role: Role.ADMIN,
      districtId: guntur.id,
      isActive: true,
    },
    create: {
      name: "Seed Admin",
      phone: "9000000001",
      password: await hash("Admin@123"),
      role: Role.ADMIN,
      districtId: guntur.id,
    },
  });

  const chairman = await prisma.user.upsert({
    where: { phone: "9000000002" },
    update: {
      name: "Seed Chairman",
      password: await hash("Chairman@123"),
      role: Role.CHAIRMAN,
      districtId: guntur.id,
      isActive: true,
    },
    create: {
      name: "Seed Chairman",
      phone: "9000000002",
      password: await hash("Chairman@123"),
      role: Role.CHAIRMAN,
      districtId: guntur.id,
    },
  });

  const accounts = await prisma.user.upsert({
    where: { phone: "9000000003" },
    update: {
      name: "Seed Accounts",
      password: await hash("Accounts@123"),
      role: Role.ACCOUNTS,
      districtId: guntur.id,
      isActive: true,
    },
    create: {
      name: "Seed Accounts",
      phone: "9000000003",
      password: await hash("Accounts@123"),
      role: Role.ACCOUNTS,
      districtId: guntur.id,
    },
  });

  const inspector = await prisma.user.upsert({
    where: { phone: "9000000004" },
    update: {
      name: "Seed Inspector",
      password: await hash("Inspector@123"),
      role: Role.INSPECTOR,
      districtId: guntur.id,
      isActive: true,
    },
    create: {
      name: "Seed Inspector",
      phone: "9000000004",
      password: await hash("Inspector@123"),
      role: Role.INSPECTOR,
      districtId: guntur.id,
    },
  });

  void chairman;
  void accounts;

  const institutions = [
    {
      id: SEED.inst1,
      name: "AP Model School — Guntur North",
      category: "Education",
      address: "Amaravathi Road, Guntur",
      contactName: "Headmaster",
      contactPhone: "9100000001",
    },
    {
      id: SEED.inst2,
      name: "District Cooperative Hospital",
      category: "Healthcare",
      address: "Kothapet, Guntur",
      contactName: "Superintendent",
      contactPhone: "9100000002",
    },
    {
      id: SEED.inst3,
      name: "Guntur Municipal Market Traders Association",
      category: "Trade",
      address: "Arundelpet, Guntur",
      contactName: "Secretary",
      contactPhone: "9100000003",
    },
    {
      id: SEED.inst4,
      name: "Industrial Training Institute — Patamata",
      category: "Education",
      address: "Patamata, Guntur",
      contactName: "Principal",
      contactPhone: "9100000004",
    },
    {
      id: SEED.inst5,
      name: "Zilla Parishad High School — Pedakakani",
      category: "Education",
      address: "Pedakakani, Guntur",
      contactName: "HM",
      contactPhone: "9100000005",
    },
  ];

  for (const inst of institutions) {
    await prisma.institution.upsert({
      where: { id: inst.id },
      update: {
        name: inst.name,
        category: inst.category,
        address: inst.address,
        contactName: inst.contactName,
        contactPhone: inst.contactPhone,
        districtId: guntur.id,
        isActive: true,
      },
      create: {
        id: inst.id,
        districtId: guntur.id,
        name: inst.name,
        category: inst.category,
        address: inst.address,
        contactName: inst.contactName,
        contactPhone: inst.contactPhone,
      },
    });
  }

  const fy = "2024-25";
  const due = new Date("2025-03-31");

  await prisma.demandNotice.upsert({
    where: { id: SEED.demand1 },
    update: {
      inspectorId: inspector.id,
      amountDue: "125000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
    },
    create: {
      id: SEED.demand1,
      institutionId: SEED.inst1,
      inspectorId: inspector.id,
      districtId: guntur.id,
      amountDue: "125000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
      createdBy: admin.id,
    },
  });

  await prisma.demandNotice.upsert({
    where: { id: SEED.demand2 },
    update: {
      inspectorId: inspector.id,
      amountDue: "85000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
    },
    create: {
      id: SEED.demand2,
      institutionId: SEED.inst2,
      inspectorId: inspector.id,
      districtId: guntur.id,
      amountDue: "85000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
      createdBy: admin.id,
    },
  });

  await prisma.demandNotice.upsert({
    where: { id: SEED.demand3 },
    update: {
      inspectorId: inspector.id,
      amountDue: "45000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
    },
    create: {
      id: SEED.demand3,
      institutionId: SEED.inst3,
      inspectorId: inspector.id,
      districtId: guntur.id,
      amountDue: "45000.00",
      financialYear: fy,
      dueDate: due,
      status: "PENDING",
      createdBy: admin.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed completed: districts, users, institutions, demands.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
