"use strict";

import { Dexie } from 'dexie';

import type { Table } from 'dexie';
import type { Tariff, Consumption, Standing } from './db_types';

// TODO: Use "virtual tables" instead, define a tariff table, consumption table, and possibly standing table
// Put all data into that with a key (like region or tariff name) that can be used to sort the data
// Fixes issue of any number of comparison tariffs being possible


class AppDB extends Dexie {
  tariff!: Table<Tariff, number>;
  consumption!: Table<Consumption, number>;
  standing!: Table<Standing, number>;

  constructor() {
    super('user');

    this.version(1).stores({
      tariff: '[tariff+valid_from]',
      consumption: 'valid_from',
      standing: '[tariff+valid_from]'
    });
  }
}

export const db = new AppDB();


