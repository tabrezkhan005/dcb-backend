import { z } from "zod";

export const SubmitCollectionSchema = z.object({
  demandId: z.string().uuid(),
  amountCollected: z.union([z.number().positive(), z.string()]),
  paymentMode: z.enum(["CASH", "CHEQUE", "UPI", "DD"]),
  referenceNo: z.string().max(128).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const AcceptCollectionSchema = z.object({}).passthrough();

export const QueryCollectionSchema = z.object({
  note: z.string().min(1).max(2000),
});

export const CollectionListQuerySchema = z.object({
  status: z.enum(["SUBMITTED", "ACCEPTED", "QUERIED"]).optional(),
  districtId: z.string().uuid().optional(),
  inspectorId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
