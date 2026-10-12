-- OFFLINE REVIEW ONLY. Not applied. Use the generated Prisma migration and its pre/postchecks.

CREATE TABLE "public"."complianceIdentity" (
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "dateOfBirth" text,
  "evidenceRef" text,
  "expiresAt" timestamptz,
  "id" text NOT NULL,
  "status" text DEFAULT 'NOT_VERIFIED' NOT NULL,
  "subjectId" text NOT NULL,
  "subjectType" text NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "verifiedAt" timestamptz,
  "verifiedBy" text,
  "workspaceId" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "compliance_identity_status_f0acc6da" CHECK (status IN ('NOT_VERIFIED', 'VERIFIED', 'REJECTED')),
  CONSTRAINT "compliance_identity_subject_8016ac06" CHECK ("subjectType" IN ('USER', 'PERFORMER'))
);

CREATE TABLE "public"."complianceNote" (
  "actorId" text NOT NULL,
  "body" text NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "id" text NOT NULL,
  "objectId" text NOT NULL,
  "objectType" text NOT NULL,
  "workspaceId" text NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "public"."complianceReport" (
  "contentUrl" text NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "decision" text,
  "depictedPerson" bool DEFAULT false NOT NULL,
  "description" text NOT NULL,
  "dueAt" timestamptz NOT NULL,
  "id" text NOT NULL,
  "kind" text DEFAULT 'CONTENT' NOT NULL,
  "priority" text DEFAULT 'NORMAL' NOT NULL,
  "reason" text NOT NULL,
  "reporterEmail" text NOT NULL,
  "reporterName" text NOT NULL,
  "resolvedAt" timestamptz,
  "status" text DEFAULT 'OPEN' NOT NULL,
  "supportingInfo" text,
  "updatedAt" timestamptz NOT NULL,
  "videoProductId" text,
  "workspaceId" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "compliance_report_status_f4b1f260" CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'REJECTED'))
);

CREATE TABLE "public"."contentConsent" (
  "depiction" bool DEFAULT false NOT NULL,
  "distribution" bool DEFAULT false NOT NULL,
  "downloads" bool DEFAULT false NOT NULL,
  "evidenceRef" text NOT NULL,
  "id" text NOT NULL,
  "mediaFingerprint" text NOT NULL,
  "performerId" text NOT NULL,
  "publication" bool DEFAULT false NOT NULL,
  "recordedAt" timestamptz DEFAULT (now()) NOT NULL,
  "recordedBy" text NOT NULL,
  "status" text DEFAULT 'RECORDED' NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "videoProductId" text NOT NULL,
  "workspaceId" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "content_consent_status_3b87e629" CHECK (status IN ('RECORDED', 'DISPUTED', 'REVOKED'))
);

CREATE TABLE "public"."contentReview" (
  "allPersonsConfirmed" bool DEFAULT false NOT NULL,
  "copyrightConfirmed" bool DEFAULT false NOT NULL,
  "createdAt" timestamptz DEFAULT (now()) NOT NULL,
  "decision" text,
  "fingerprint" text,
  "id" text NOT NULL,
  "prohibitedChecked" bool DEFAULT false NOT NULL,
  "providerUserId" text,
  "recordedOn" text,
  "reviewedAt" timestamptz,
  "reviewedBy" text,
  "status" text DEFAULT 'DRAFT' NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "videoProductId" text NOT NULL,
  "workspaceId" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "content_review_status_3269faac" CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REMOVED'))
);

ALTER TABLE "public"."videoProduct" ADD COLUMN "complianceStatus" text DEFAULT 'LEGACY_UNREVIEWED' NOT NULL;

ALTER TABLE "public"."contentReview" ADD CONSTRAINT "contentReview_videoProductId_key" UNIQUE ("videoProductId");

CREATE INDEX "complianceIdentity_workspaceId_idx_ba65f874" ON "public"."complianceIdentity" ("workspaceId");

CREATE INDEX "compliance_identity_subject_history_a9621434" ON "public"."complianceIdentity" ("workspaceId", "subjectType", "subjectId", "createdAt");

CREATE INDEX "complianceNote_workspaceId_idx_ba65f874" ON "public"."complianceNote" ("workspaceId");

CREATE INDEX "complianceNote_workspaceId_objectType_objectId_idx_10fc17db" ON "public"."complianceNote" ("workspaceId", "objectType", "objectId");

CREATE INDEX "complianceReport_priority_dueAt_idx_2d1f73c8" ON "public"."complianceReport" ("priority", "dueAt");

CREATE INDEX "complianceReport_videoProductId_idx_77e8a66c" ON "public"."complianceReport" ("videoProductId");

CREATE INDEX "complianceReport_workspaceId_idx_ba65f874" ON "public"."complianceReport" ("workspaceId");

CREATE INDEX "complianceReport_workspaceId_status_idx_76d68132" ON "public"."complianceReport" ("workspaceId", "status");

CREATE INDEX "contentConsent_performerId_idx_568c0ad9" ON "public"."contentConsent" ("performerId");

CREATE INDEX "contentConsent_videoProductId_idx_77e8a66c" ON "public"."contentConsent" ("videoProductId");

CREATE INDEX "contentConsent_workspaceId_idx_ba65f874" ON "public"."contentConsent" ("workspaceId");

CREATE INDEX "content_consent_person_history_00fad401" ON "public"."contentConsent" ("videoProductId", "performerId", "recordedAt");

CREATE INDEX "contentReview_workspaceId_idx_ba65f874" ON "public"."contentReview" ("workspaceId");

CREATE INDEX "contentReview_workspaceId_status_idx_76d68132" ON "public"."contentReview" ("workspaceId", "status");

ALTER TABLE "public"."complianceIdentity"
ADD CONSTRAINT "complianceIdentity_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "public"."workspace" ("id");

ALTER TABLE "public"."complianceNote"
ADD CONSTRAINT "complianceNote_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "public"."workspace" ("id");

ALTER TABLE "public"."complianceReport"
ADD CONSTRAINT "complianceReport_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "public"."workspace" ("id");

ALTER TABLE "public"."complianceReport"
ADD CONSTRAINT "complianceReport_videoProductId_fkey"
FOREIGN KEY ("videoProductId")
REFERENCES "public"."videoProduct" ("id");

ALTER TABLE "public"."contentConsent"
ADD CONSTRAINT "contentConsent_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "public"."workspace" ("id");

ALTER TABLE "public"."contentConsent"
ADD CONSTRAINT "contentConsent_videoProductId_fkey"
FOREIGN KEY ("videoProductId")
REFERENCES "public"."videoProduct" ("id");

ALTER TABLE "public"."contentConsent"
ADD CONSTRAINT "contentConsent_performerId_fkey"
FOREIGN KEY ("performerId")
REFERENCES "public"."performer" ("id");

ALTER TABLE "public"."contentReview"
ADD CONSTRAINT "contentReview_workspaceId_fkey"
FOREIGN KEY ("workspaceId")
REFERENCES "public"."workspace" ("id");

ALTER TABLE "public"."contentReview"
ADD CONSTRAINT "contentReview_videoProductId_fkey"
FOREIGN KEY ("videoProductId")
REFERENCES "public"."videoProduct" ("id");
