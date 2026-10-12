#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/38d015faa8523a0445906b9b9da4c7e82aac77d6a5aa9899f13a9f8954e1c115/contract';
import endContract from '../../snapshots/38d015faa8523a0445906b9b9da4c7e82aac77d6a5aa9899f13a9f8954e1c115/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686/contract';
import startContract from '../../snapshots/c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'complianceIdentity',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dateOfBirth', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('evidenceRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('NOT_VERIFIED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subjectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subjectType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('verifiedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('verifiedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'compliance_identity_status_f0acc6da',
            "status IN ('NOT_VERIFIED', 'VERIFIED', 'REJECTED')",
          ),
          checkExpression(
            'compliance_identity_subject_8016ac06',
            "\"subjectType\" IN ('USER', 'PERFORMER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'complianceNote',
        columns: [
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('objectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('objectType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'complianceReport',
        columns: [
          col('contentUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('decision', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('depictedPerson', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dueAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', {
            notNull: true,
            default: lit('CONTENT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('priority', 'text', {
            notNull: true,
            default: lit('NORMAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reporterEmail', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reporterName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('OPEN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('supportingInfo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('videoProductId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'compliance_report_status_f4b1f260',
            "status IN ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'REJECTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'contentConsent',
        columns: [
          col('depiction', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('distribution', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('downloads', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('evidenceRef', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mediaFingerprint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('performerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publication', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('recordedBy', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('RECORDED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('videoProductId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'content_consent_status_3b87e629',
            "status IN ('RECORDED', 'DISPUTED', 'REVOKED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'contentReview',
        columns: [
          col('allPersonsConfirmed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('copyrightConfirmed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('decision', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fingerprint', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('prohibitedChecked', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('providerUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recordedOn', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('reviewedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('videoProductId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'content_review_status_3269faac',
            "status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REMOVED')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'videoProduct',
        column: col('complianceStatus', 'text', {
          notNull: true,
          default: lit('LEGACY_UNREVIEWED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'contentReview',
        constraint: 'contentReview_videoProductId_key',
        columns: ['videoProductId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceIdentity',
        index: 'complianceIdentity_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceIdentity',
        index: 'compliance_identity_subject_history_a9621434',
        columns: ['workspaceId', 'subjectType', 'subjectId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceNote',
        index: 'complianceNote_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceNote',
        index: 'complianceNote_workspaceId_objectType_objectId_idx_10fc17db',
        columns: ['workspaceId', 'objectType', 'objectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceReport',
        index: 'complianceReport_priority_dueAt_idx_2d1f73c8',
        columns: ['priority', 'dueAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceReport',
        index: 'complianceReport_videoProductId_idx_77e8a66c',
        columns: ['videoProductId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceReport',
        index: 'complianceReport_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'complianceReport',
        index: 'complianceReport_workspaceId_status_idx_76d68132',
        columns: ['workspaceId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentConsent',
        index: 'contentConsent_performerId_idx_568c0ad9',
        columns: ['performerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentConsent',
        index: 'contentConsent_videoProductId_idx_77e8a66c',
        columns: ['videoProductId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentConsent',
        index: 'contentConsent_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentConsent',
        index: 'content_consent_person_history_00fad401',
        columns: ['videoProductId', 'performerId', 'recordedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentReview',
        index: 'contentReview_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contentReview',
        index: 'contentReview_workspaceId_status_idx_76d68132',
        columns: ['workspaceId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'complianceIdentity',
        foreignKey: {
          name: 'complianceIdentity_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'complianceNote',
        foreignKey: {
          name: 'complianceNote_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'complianceReport',
        foreignKey: {
          name: 'complianceReport_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'complianceReport',
        foreignKey: {
          name: 'complianceReport_videoProductId_fkey',
          columns: ['videoProductId'],
          references: { schema: 'public', table: 'videoProduct', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contentConsent',
        foreignKey: {
          name: 'contentConsent_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contentConsent',
        foreignKey: {
          name: 'contentConsent_videoProductId_fkey',
          columns: ['videoProductId'],
          references: { schema: 'public', table: 'videoProduct', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contentConsent',
        foreignKey: {
          name: 'contentConsent_performerId_fkey',
          columns: ['performerId'],
          references: { schema: 'public', table: 'performer', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contentReview',
        foreignKey: {
          name: 'contentReview_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contentReview',
        foreignKey: {
          name: 'contentReview_videoProductId_fkey',
          columns: ['videoProductId'],
          references: { schema: 'public', table: 'videoProduct', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
