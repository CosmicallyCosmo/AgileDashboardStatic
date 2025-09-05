"use strict";

export function createDB(db) {
   db.version(1).stores({
      consumption: `
        start_interval,
        end_interval,
        consumption`,
    });

}