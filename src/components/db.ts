import { Dexie } from 'dexie';
import { regions } from './db_types';

import type { Table } from 'dexie';
import type { ConsumptionRow, RegionRow, Region } from './db_types';


class TypedDB extends Dexie {
  consumption!: Table<ConsumptionRow, number>;

  constructor() {
    super("userData");

    const schema = "valid_from,valid_to,value_inc_vat";
    const storesDef: Record<string, string> = Object.fromEntries(
      regions.map((name) => [name, schema])
    );
    storesDef.consumption = "interval_start,interval_end,consumption";

    this.version(1).stores(storesDef);
  }
}

type RegionTables = {
  [K in Region]: Table<RegionRow, number>;
};

interface TypedDB extends RegionTables { }

export const db = new TypedDB();

const schema = "valid_from,valid_to,value_inc_vat"
let storesDef = Object.fromEntries(
  regions.map(name => [name, schema])
);
storesDef.consumption = "interval_start,interval_end,consumption";
db.version(1).stores(storesDef);
