#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/25112945bbfce47277c21886bd6142492a366bfcead00d6ac15ec7736511f28f/contract';
import startContract from '../../snapshots/25112945bbfce47277c21886bd6142492a366bfcead00d6ac15ec7736511f28f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e80392bdce746abf03970fe033403ffc1457071f57040cab1e97a4426352deeb/contract';
import endContract from '../../snapshots/e80392bdce746abf03970fe033403ffc1457071f57040cab1e97a4426352deeb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'platformPublication',
        column: col('publishingOptions', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
