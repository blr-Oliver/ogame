import {DebrisGalaxyInfo, GalaxyClass, GalaxyRepository, GalaxySlot, GalaxySlotCoordinates, GalaxySystemInfo} from 'ogame-api-facade';
import {Coordinates, SystemCoordinates} from 'ogame-core/types/core';
import {db} from './db';
import {valueToSQLString} from './db-common';
import {COORDINATES_MAPPING, createPlainMapping, extractObject, FieldMapping, packObject} from './object-mapping';

export class SqlGalaxyRepository implements GalaxyRepository {
  private static readonly GALAXY_REPORT_MAPPING: FieldMapping = createPlainMapping(['galaxy', 'system', 'timestamp', 'empty']);
  private static readonly GALAXY_SLOT_MAPPING: FieldMapping = {
    galaxy: ['galaxy'],
    system: ['system'],
    position: ['position'],
    timestamp: ['timestamp'],
    planet_id: ['planet', 'id'],
    planet_name: ['planet', 'name'],
    moon_id: ['moon', 'id'],
    moon_size: ['moon', 'size'],
    player_id: ['player', 'id'],
    player_name: ['player', 'name'],
    player_status: ['player', 'rawStatus'],
    player_rank: ['player', 'rank'],
    alliance_id: ['alliance', 'id'],
    alliance_name: ['alliance', 'name'],
    alliance_rank: ['alliance', 'rank'],
    alliance_members: ['alliance', 'members'],
    debris_metal: ['debris', 'metal'],
    debris_crystal: ['debris', 'crystal']
  };

  constructor() {
    // TODO add cache
  }

  loadSystem(galaxy: number, system: number): Promise<GalaxySystemInfo | undefined> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
      // intentionally ignoring 'empty' field
          `select r.timestamp, s.* from galaxy_report r left join galaxy_report_slot s
           on s.galaxy = r.galaxy and s.system = r.system
           where r.galaxy = ${galaxy} and r.system = ${system}`,
      nestTables: true
    }).then((rows: any[]) => {
      if (rows.length) {
        const slots: GalaxySlot[] = Array(16).fill(null);
        const result: GalaxySystemInfo = {galaxy, system, slots, timestamp: rows[0]['r'].timestamp, empty: false, class: GalaxyClass.Unknown};
        for (let i = 0; i < rows.length; ++i) {
          let rawSlot = rows[i]['s'];
          if (rawSlot)
            slots[rawSlot.position - 1] = extractObject(rawSlot, SqlGalaxyRepository.GALAXY_SLOT_MAPPING);
        }
        result.empty = result.slots.every(x => !x);
        return result;
      }
    });
  }

  findNextStale(normalTimeout: number, emptyTimeout: number, [galaxy, system]: SystemCoordinates = [1, 1]): Promise<SystemCoordinates | undefined> {
    return Promise.reject('not implemented'); // TODO
  }

  findNextMissing(maxGalaxy: number, maxSystem: number, [galaxy, system]: SystemCoordinates = [1, 1]): Promise<SystemCoordinates | undefined> {
    return Promise.reject('not implemented'); // TODO
  }

  findNextStaleEx(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, normalTimeout: number, emptyTimeout: number,
                  galaxyLast?: number, systemLast?: number): Promise<Coordinates | undefined> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:  // TODO check if it is still correct
          `select galaxy, system, null as 'position' from galaxy_report where
              galaxy >= ${galaxyMin} and galaxy <= ${galaxyMax} and system >= ${systemMin} and system <= ${systemMax}
              and (galaxy = ${galaxyLast || 0} and system > ${systemLast || 0} or galaxy > ${galaxyLast || 0})
              and (empty = 1 and timestamp < date_sub(now(), interval ${emptyTimeout} second) 
                   or empty = 0 and timestamp < date_sub(now(), interval ${normalTimeout} second))
              order by galaxy asc, system asc
              limit 1;`
    }).then((rows: any[]) => extractObject(rows[0], COORDINATES_MAPPING));
  }

  findInactiveTargets(): Promise<Coordinates[]> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:  // TODO exact status names depend on the language of the universe
          `select galaxy, system, position from galaxy_report_slot
             where (player_status like '%i%' or player_status like '%I%')
             and player_status not like '%РО%' and player_status not like '%A%'`
    }).then((rows: any[]) => rows.map(row => extractObject(row, COORDINATES_MAPPING)));
  }

  findAllStale(normalTimeout: number, emptyTimeout: number): Promise<SystemCoordinates[]> {
    return Promise.resolve([]); // TODO
  }

  findAllMissing(maxGalaxy: number, maxSystem: number): Promise<SystemCoordinates[]> {
    return Promise.resolve([]); // TODO
  }

  findStaleSystemsWithTargets(timeout: number): Promise<SystemCoordinates[]> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
          `select distinct r.galaxy, r.system, NULL as 'position'
           from galaxy_report_slot s join galaxy_report r
           on s.galaxy = r.galaxy and s.system = r.system
           where s.player_status not like '%A%'
             and r.timestamp < date_sub(now(), interval ${timeout} second)`
    })
        .then((rows: any[]) => rows.map(row => extractObject(row, COORDINATES_MAPPING)))
        .then((coordinates: Coordinates[]) => coordinates.map(c => [c.galaxy, c.system]));
  }

  store(galaxy: GalaxySystemInfo): Promise<void> {
    let reportData = packObject(galaxy, SqlGalaxyRepository.GALAXY_REPORT_MAPPING);
    let reportKeys = Object.keys(reportData);
    let reportValues = reportKeys.map(key => valueToSQLString(reportData[key]));
    let isEmpty = galaxy.empty = galaxy.slots.every(x => !x); // force correct value
    return db.query({
      sql:
          `insert into galaxy_report(${reportKeys.join(', ')}) values
           (${reportValues.join(', ')})
           on duplicate key update timestamp = values(timestamp), empty = values(empty)`
    }).then(() => {
      // FIXME whoa! why do I delete old report slots? that would be cool to see galaxy's history
      if (!isEmpty) {
        let emptyPositions: number[] = galaxy.slots.reduce((list, slot, index) => {
          if (!slot) list.push(index + 1);
          return list;
        }, [] as number[]);
        if (!emptyPositions.length) return null;
        return db.query({
          sql: `
        delete from galaxy_report_slot
          where galaxy = ${galaxy.galaxy} and system = ${galaxy.system} and position in (${emptyPositions.join(', ')})`
        });
      } else {
        return db.query({
          sql: `
        delete from galaxy_report_slot
          where galaxy = ${galaxy.galaxy} and system = ${galaxy.system}`
        });
      }
    }).then(() => {
      if (isEmpty) return;
      let slotKeys = Object.keys(SqlGalaxyRepository.GALAXY_SLOT_MAPPING);
      // FIXME this thing excludes timestamp from stored fields, but it actually SHOULD be stored
      slotKeys.splice(3, 1);
      let records: string[] = [];
      galaxy.slots.forEach(slot => {
        if (slot) {
          let preparedData = packObject(slot, SqlGalaxyRepository.GALAXY_SLOT_MAPPING);
          let slotValues = slotKeys.map(key => valueToSQLString(preparedData[key]));
          records.push(`(${slotValues.join(', ')})`);
        }
      });
      if (!records.length) return;
      return db.query({
        sql: `
      insert into galaxy_report_slot(${slotKeys.join(', ')}) values
        ${records.join(',\n')} on duplicate key update
        ${slotKeys.map(key => `${key} = values(${key})`).join(', ')}
      `
      });
    });
  }

  findAllCurrentDebris(): Promise<(GalaxySlotCoordinates & DebrisGalaxyInfo)[]> {
    // TODO not implemented
    throw new Error('not implemented');
  }

  selectLatestReports(): Promise<GalaxySystemInfo[]> {
    return Promise.reject('not implemented'); // TODO
  }
}
