-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INSPECTOR', 'ACCOUNTS', 'ADMIN', 'CHAIRMAN');

-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('PENDING', 'PARTIAL', 'COLLECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'QUERIED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CHEQUE', 'UPI', 'DD');

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hq_city" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "device_id" TEXT,
    "push_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_notices" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "inspector_id" TEXT,
    "district_id" TEXT NOT NULL,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "financial_year" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "DemandStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "inspector_id" TEXT NOT NULL,
    "amount_collected" DECIMAL(14,2) NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "reference_no" TEXT,
    "status" "CollectionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "accounts_note" TEXT,
    "accounts_user_id" TEXT,
    "receipt_number" TEXT,
    "receipt_s3_key" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_district_id" TEXT NOT NULL,
    "to_district_id" TEXT NOT NULL,
    "transferred_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" TEXT,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "districts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_district_id_idx" ON "users"("district_id");

-- CreateIndex
CREATE INDEX "users_role_district_id_idx" ON "users"("role", "district_id");

-- CreateIndex
CREATE INDEX "institutions_district_id_idx" ON "institutions"("district_id");

-- CreateIndex
CREATE INDEX "demand_notices_inspector_id_status_idx" ON "demand_notices"("inspector_id", "status");

-- CreateIndex
CREATE INDEX "demand_notices_district_id_financial_year_idx" ON "demand_notices"("district_id", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "collections_receipt_number_key" ON "collections"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "collections_idempotency_key_key" ON "collections"("idempotency_key");

-- CreateIndex
CREATE INDEX "collections_demand_id_idx" ON "collections"("demand_id");

-- CreateIndex
CREATE INDEX "collections_inspector_id_status_idx" ON "collections"("inspector_id", "status");

-- CreateIndex
CREATE INDEX "collections_submitted_at_idx" ON "collections"("submitted_at");

-- CreateIndex
CREATE INDEX "transfer_logs_user_id_idx" ON "transfer_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_notices" ADD CONSTRAINT "demand_notices_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_notices" ADD CONSTRAINT "demand_notices_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_notices" ADD CONSTRAINT "demand_notices_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_notices" ADD CONSTRAINT "demand_notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demand_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_accounts_user_id_fkey" FOREIGN KEY ("accounts_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_from_district_id_fkey" FOREIGN KEY ("from_district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_to_district_id_fkey" FOREIGN KEY ("to_district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
