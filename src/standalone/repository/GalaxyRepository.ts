import {Coordinates} from '../../common/types';
import {GalaxySlotInfo, GalaxySystemInfo} from '../../browser/parsers/galaxy-reports';
import {db} from './db';
import {valueToSQLString} from './db-common';
import {createPlainMapping, extractObject, FieldMapping, packObject} from './object-mapping';

export class GalaxyRepository {
  static readonly COORDINATES_MAPPING: FieldMapping = createPlainMapping(['galaxy', 'system', 'position', 'type']);
  private static readonly GALAXY_REPORT_MAPPING: FieldMapping = createPlainMapping(['galaxy', 'system', 'timestamp', 'empty']);
  private static readonly GALAXY_SLOT_MAPPING: FieldMapping = {
    planet_id: ['planet', 'id'],
    planet_name: ['planet', 'name'],
    moon_id: ['moon', 'id'],
    moon_size: ['moon', 'size'],
    player_id: ['player', 'id'],
    player_name: ['player', 'name'],
    player_status: ['player', 'status'],
    player_rank: ['player', 'rank'],
    alliance_id: ['alliance', 'id'],
    alliance_name: ['alliance', 'name'],
    alliance_rank: ['alliance', 'rank'],
    alliance_members: ['alliance', 'members'],
    debris_metal: ['debris', 'metal'],
    debris_crystal: ['debris', 'crystal']
  };

  static readonly instance: GalaxyRepository = new GalaxyRepository();

  constructor() {
    // TODO add cache
  }

  load(galaxy: number, system: number): Promise<GalaxySystemInfo | null> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
      // intentionally ignoring 'empty' field
          `select r.timestamp, s.* from galaxy_report r left join galaxy_report_slot s
           on s.galaxy = r.galaxy and s.system = r.system
           where r.galaxy = ${galaxy} and r.system = ${system}`,
      nestTables: true
    }).then((rows: any[]) => {
      if (!rows.length) return null;
      const slots: GalaxySlotInfo[] = Array(15).fill(null);
      const result: GalaxySystemInfo = {galaxy, system, slots, timestamp: rows[0]['r'].timestamp, empty: false};
      for (let i = 0; i < rows.length; ++i) {
        let rawSlot = rows[i]['s'];
        if (rawSlot)
          slots[rawSlot.position - 1] = extractObject(rawSlot, GalaxyRepository.GALAXY_SLOT_MAPPING);
      }
      result.empty = result.slots.every(x => !x); // set actual value
      return result;
    });
  }

  loadC(coordinates: Coordinates): Promise<GalaxySystemInfo | null> {
    return this.load(coordinates.galaxy, coordinates.system);
  }

  findNextStale(galaxyMin: number, galaxyMax: number, systemMin: number, systemMax: number, galaxyLast: number | null, systemLast: number | null,
                normalTimeout: number, emptyTimeout: number): Promise<Coordinates> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
          `select galaxy, system, null as 'position' from galaxy_report where
              galaxy >= ${galaxyMin} and galaxy <= ${galaxyMax} and system >= ${systemMin} and system <= ${systemMax}
              and (galaxy = ${galaxyLast || 0} and system > ${systemLast || 0} or galaxy > ${galaxyLast || 0})
              and (empty = 1 and timestamp < date_sub(now(), interval ${emptyTimeout} second) 
                   or empty = 0 and timestamp < date_sub(now(), interval ${normalTimeout} second))
              order by galaxy asc, system asc
              limit 1;`
    }).then((rows: any[]) => extractObject(rows[0], GalaxyRepository.COORDINATES_MAPPING));
  }

  findInactiveTargets(): Promise<Coordinates[]> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:  // TODO exact status names depend on the language of the universe
          `select galaxy, system, position from galaxy_report_slot
             where (player_status like '%i%' or player_status like '%I%')
             and player_status not like '%РО%' and player_status not like '%A%'`
    }).then((rows: any[]) => rows.map(row => extractObject(row, GalaxyRepository.COORDINATES_MAPPING)));
  }

  findStaleSystemsWithTargets(timeout: number): Promise<Coordinates[]> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
          `select distinct r.galaxy, r.system, NULL as 'position'
           from galaxy_report_slot s join galaxy_report r
           on s.galaxy = r.galaxy and s.system = r.system
           where s.player_status not like '%A%'
             and r.timestamp < date_sub(now(), interval ${timeout} second)`
    }).then((rows: any[]) => rows.map(row => extractObject(row, GalaxyRepository.COORDINATES_MAPPING)));
  }

  store(galaxy: GalaxySystemInfo): Promise<void> {
    let reportData = packObject(galaxy, GalaxyRepository.GALAXY_REPORT_MAPPING);
    let reportKeys = Object.keys(reportData);
    let reportValues = reportKeys.map(key => valueToSQLString(reportData[key]));
    let isEmpty = galaxy.empty = galaxy.slots.every(x => !x); // force correct value
    return db.query({
      sql:
          `insert into galaxy_report(${reportKeys.join(', ')}) values
           (${reportValues.join(', ')})
           on duplicate key update timestamp = values(timestamp), empty = values(empty)`
    }).then(() => {
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
      let implicitKeys = ['galaxy', 'system', 'position'];
      let slotKeys = Object.keys(GalaxyRepository.GALAXY_SLOT_MAPPING);
      let recordKeys = implicitKeys.concat(slotKeys);
      let records: string[] = [];
      galaxy.slots.forEach((slot, index) => {
        if (slot) {
          const position = index + 1;
          let preparedData = packObject(slot, GalaxyRepository.GALAXY_SLOT_MAPPING);
          let slotValues = slotKeys.map(key => valueToSQLString(preparedData[key]));
          let values = [galaxy.galaxy, galaxy.system, position].map(String).concat(slotValues);
          records.push(`(${values.join(', ')})`);
        }
      });
      if (!records.length) return;
      return db.query({
        sql: `
      insert into galaxy_report_slot(${recordKeys.join(', ')}) values
        ${records.join(',\n')} on duplicate key update
        ${slotKeys.map(key => `${key} = values(${key})`).join(', ')}
      `
      });
    });
  }
}