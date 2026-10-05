#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e80392bdce746abf03970fe033403ffc1457071f57040cab1e97a4426352deeb/contract';
import startContract from '../../snapshots/e80392bdce746abf03970fe033403ffc1457071f57040cab1e97a4426352deeb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fa7b1d3dba4a93a989ea586faa866864a3f51e32a1e0ba119be6b53a2bda2717/contract';
import endContract from '../../snapshots/fa7b1d3dba4a93a989ea586faa866864a3f51e32a1e0ba119be6b53a2bda2717/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'videoProduct',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('featured', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mediaAssetId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('priceCents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('teaserMediaAssetId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('thumbnailMediaAssetId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'videoProduct',
        constraint: 'videoProduct_slug_key',
        columns: ['slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'videoProduct',
        index: 'videoProduct_mediaAssetId_idx_523c8890',
        columns: ['mediaAssetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'videoProduct',
        index: 'videoProduct_status_publishedAt_idx_4d4b1960',
        columns: ['status', 'publishedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'videoProduct',
        index: 'videoProduct_teaserMediaAssetId_idx_18deabb8',
        columns: ['teaserMediaAssetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'videoProduct',
        index: 'videoProduct_thumbnailMediaAssetId_idx_907f6177',
        columns: ['thumbnailMediaAssetId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'videoProduct',
        index: 'videoProduct_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'videoProduct',
        foreignKey: {
          name: 'videoProduct_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'videoProduct',
        foreignKey: {
          name: 'videoProduct_mediaAssetId_fkey',
          columns: ['mediaAssetId'],
          references: { schema: 'public', table: 'mediaAsset', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'videoProduct',
        foreignKey: {
          name: 'videoProduct_teaserMediaAssetId_fkey',
          columns: ['teaserMediaAssetId'],
          references: { schema: 'public', table: 'mediaAsset', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'videoProduct',
        foreignKey: {
          name: 'videoProduct_thumbnailMediaAssetId_fkey',
          columns: ['thumbnailMediaAssetId'],
          references: { schema: 'public', table: 'mediaAsset', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
