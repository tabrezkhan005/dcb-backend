import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Generates AP-{DISTRICTCODE}-{YEAR}-{SEQUENCE} within the caller's transaction
 * (use Serializable isolation on the outer transaction for concurrency safety).
 */
export async function generateReceiptNumber(
  db: DbClient,
  districtCode: string,
  year: number,
): Promise<string> {
  const normalizedCode = districtCode.toUpperCase();
  const prefix = `AP-${normalizedCode}-${year}-`;

  const last = await db.collection.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });

  let nextSeq = 1;
  if (last?.receiptNumber !== undefined && last.receiptNumber !== null) {
    const parts = last.receiptNumber.split("-");
    const seqPart = parts[parts.length - 1];
    const parsed = Number.parseInt(seqPart ?? "", 10);
    if (!Number.isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}
