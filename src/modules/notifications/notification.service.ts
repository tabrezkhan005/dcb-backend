import { notificationsQueue } from "../../config/queue";
import { prisma } from "../../config/database";
import { log } from "../../utils/logger";

async function enqueuePush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const unique = [...new Set(tokens.filter((t) => t.length > 0))];
  if (unique.length === 0) {
    return;
  }
  await notificationsQueue.add("push", {
    tokens: unique,
    title,
    body,
    data,
  });
}

export async function notifyAccountsNewCollection(
  districtId: string,
  collectionId: string,
  institutionName: string,
  amount: string,
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "ACCOUNTS",
        districtId,
        isActive: true,
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });
    const tokens = users
      .map((u) => u.pushToken)
      .filter((t): t is string => t !== null && t.length > 0);
    await enqueuePush(
      tokens,
      "New collection submitted",
      `${institutionName}: ₹${amount} pending verification`,
      { collectionId, type: "COLLECTION_SUBMITTED" },
    );
  } catch (err) {
    log.error("notifyAccountsNewCollection failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyInspectorCollectionAccepted(
  inspectorId: string,
  receiptNumber: string,
  amount: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: inspectorId },
      select: { pushToken: true },
    });
    if (user === null || user.pushToken === null || user.pushToken === undefined) {
      return;
    }
    await enqueuePush(
      [user.pushToken],
      "Collection accepted",
      `Receipt ${receiptNumber} for ₹${amount} has been accepted.`,
      { receiptNumber, type: "COLLECTION_ACCEPTED" },
    );
  } catch (err) {
    log.error("notifyInspectorCollectionAccepted failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyInspectorCollectionQueried(
  inspectorId: string,
  note: string,
  institutionName: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: inspectorId },
      select: { pushToken: true },
    });
    if (user === null || user.pushToken === null || user.pushToken === undefined) {
      return;
    }
    await enqueuePush(
      [user.pushToken],
      "Collection queried",
      `${institutionName}: Accounts has raised a query. Note: ${note}`,
      { type: "COLLECTION_QUERIED" },
    );
  } catch (err) {
    log.error("notifyInspectorCollectionQueried failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyInspectorNewDemand(
  inspectorId: string,
  institutionName: string,
  amount: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: inspectorId },
      select: { pushToken: true },
    });
    if (user === null || user.pushToken === null || user.pushToken === undefined) {
      return;
    }
    await enqueuePush(
      [user.pushToken],
      "New demand assigned",
      `${institutionName}: amount due ₹${amount}`,
      { type: "DEMAND_ASSIGNED" },
    );
  } catch (err) {
    log.error("notifyInspectorNewDemand failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyInspectorTransferred(
  userId: string,
  newDistrictName: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (user === null || user.pushToken === null || user.pushToken === undefined) {
      return;
    }
    await enqueuePush(
      [user.pushToken],
      "District transfer",
      `You have been transferred to ${newDistrictName}.`,
      { type: "INSPECTOR_TRANSFERRED" },
    );
  } catch (err) {
    log.error("notifyInspectorTransferred failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
