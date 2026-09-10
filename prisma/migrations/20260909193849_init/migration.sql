-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALESPERSON', 'MANAGER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "SectionKey" AS ENUM ('INTRODUCTION', 'PROPOSED_SOLUTION', 'DELIVERABLES', 'TIMELINE', 'PRICING', 'NEXT_STEPS');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('GENERATED', 'GENERATION_FAILED', 'SECTION_REGENERATED', 'SECTION_REGENERATION_FAILED', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'ALREADY_PROCESSED', 'PDF_GENERATED', 'PDF_GENERATION_FAILED', 'SENT', 'SEND_FAILED', 'ALREADY_SENT', 'SEND_RECLAIMED_AFTER_STALL', 'LOGGING_FAILED', 'SUPPORTING_FILE_EXTRACTION_FAILED', 'USER_CONFIRMED_PROCEED_WITHOUT_FILE', 'USER_REUPLOADED_FILE', 'CLONED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "dateOfCall" TIMESTAMP(3) NOT NULL,
    "salespersonName" TEXT NOT NULL,
    "clientNeedsSummary" TEXT NOT NULL,
    "projectScope" TEXT NOT NULL,
    "goalsAndObjectives" TEXT NOT NULL,
    "recommendedServices" TEXT NOT NULL,
    "proposedTimeline" TEXT NOT NULL,
    "estimatedPricing" TEXT NOT NULL,
    "supportingText" TEXT,
    "supportingFileUrl" TEXT,
    "supportingFileExtractedText" TEXT,
    "clonedFromId" TEXT,
    "publicToken" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_sections" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sectionKey" "SectionKey" NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ActivityAction" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_publicToken_key" ON "proposals"("publicToken");

-- CreateIndex
CREATE INDEX "proposals_ownerId_idx" ON "proposals"("ownerId");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_sections_proposalId_sectionKey_key" ON "proposal_sections"("proposalId", "sectionKey");

-- CreateIndex
CREATE INDEX "activity_log_proposalId_idx" ON "activity_log"("proposalId");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
