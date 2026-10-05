#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686/contract';
import endContract from '../../snapshots/c84b413e7a38092b8187b7e13347b071097f9d151b82e7e29c6f54a30040b686/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fa7b1d3dba4a93a989ea586faa866864a3f51e32a1e0ba119be6b53a2bda2717/contract';
import startContract from '../../snapshots/fa7b1d3dba4a93a989ea586faa866864a3f51e32a1e0ba119be6b53a2bda2717/contract.json' with { type: 'json' };
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
        table: 'purchase',
        columns: [
          col('amountCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('USD'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('videoProductId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('purchase_amount_nonnegative_9ba6fead', '"amountCents" >= 0'),
          checkExpression(
            'purchase_status_valid_e1b666af',
            "status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_active_unique_046bd2f8',
        columns: ['userId', 'videoProductId'],
        extras: { where: "status IN ('PENDING', 'PAID')", unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_videoProductId_idx_77e8a66c',
        columns: ['videoProductId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchase',
        foreignKey: {
          name: 'purchase_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchase',
        foreignKey: {
          name: 'purchase_videoProductId_fkey',
          columns: ['videoProductId'],
          references: { schema: 'public', table: 'videoProduct', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
