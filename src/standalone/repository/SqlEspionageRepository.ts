import {ShardedEspionageReport, ShardHeader, StampedEspionageReport} from '../../common/report-types';
import {EspionageRepository} from '../../common/repository-types';
import {Coordinates, CoordinateType, sameCoordinates} from '../../common/types';
import {db} from './db';
import {valueToSQLString} from './db-common';
import {COORDINATES_MAPPING, extractFrom, extractObject, FieldMapping, packObject} from './object-mapping';

export class SqlEspionageRepository implements EspionageRepository {
  private static readonly ESPIONAGE_REPORT_MAPPING: FieldMapping = {
    id: ['id'],
    timestamp: ['timestamp'],
    info_level: ['infoLevel'],
    galaxy: ['coordinates', 'galaxy'],
    system: ['coordinates', 'system'],
    position: ['coordinates', 'position'],
    type: ['coordinates', 'type'],
    planet_name: ['planetName'],
    player_name: ['playerName'],
    player_status: ['playerStatus'],
    activity: ['activity', 'active'],
    activity_time: ['activity', 'time'],
    metal: ['resources', 'metal'],
    crystal: ['resources', 'crystal'],
    deut: ['resources', 'deut'],
    energy: ['resources', 'energy'],
    light_fighter: ['fleet', 'lightFighter'],
    heavy_fighter: ['fleet', 'heavyFighter'],
    cruiser: ['fleet', 'cruiser'],
    battleship: ['fleet', 'battleship'],
    battlecruiser: ['fleet', 'battlecruiser'],
    bomber: ['fleet', 'bomber'],
    destroyer: ['fleet', 'destroyer'],
    death_star: ['fleet', 'deathStar'],
    small_cargo: ['fleet', 'smallCargo'],
    large_cargo: ['fleet', 'largeCargo'],
    colony_ship: ['fleet', 'colonyShip'],
    recycler: ['fleet', 'recycler'],
    espionage_probe: ['fleet', 'espionageProbe'],
    solar_satellite: ['fleet', 'solarSatellite'],
    rocket_launcher: ['defense', 'rocketLauncher'],
    light_laser: ['defense', 'lightLaser'],
    heavy_laser: ['defense', 'heavyLaser'],
    ion_cannon: ['defense', 'ionCannon'],
    gauss_cannon: ['defense', 'gaussCannon'],
    plasma_turret: ['defense', 'plasmaTurret'],
    small_shield: ['defense', 'smallShield'],
    large_shield: ['defense', 'largeShield'],
    anti_ballistic: ['defense', 'antiBallistic'],
    interplanetary: ['defense', 'interplanetary'],
    metal_mine: ['buildings', 'metalMine'],
    crystal_mine: ['buildings', 'crystalMine'],
    deut_mine: ['buildings', 'deutMine'],
    solar_plant: ['buildings', 'solarPlant'],
    robotics: ['buildings', 'robotics'],
    shipyard: ['buildings', 'shipyard'],
    metal_storage: ['buildings', 'metalStorage'],
    crystal_storage: ['buildings', 'crystalStorage'],
    deut_storage: ['buildings', 'deutStorage'],
    research_lab: ['buildings', 'researchLab'],
    fusion_reactor: ['buildings', 'fusionReactor'],
    nanite: ['buildings', 'nanite'],
    terraformer: ['buildings', 'terraformer'],
    alliance_depot: ['buildings', 'allianceDepot'],
    missile_silo: ['buildings', 'missileSilo'],
    space_dock: ['buildings', 'spaceDock'],
    lunar_base: ['buildings', 'lunarBase'],
    sensor_phalanx: ['buildings', 'sensorPhalanx'],
    jump_gate: ['buildings', 'jumpGate'],
    energy_tech: ['researches', 'energy'],
    laser: ['researches', 'laser'],
    ion: ['researches', 'ion'],
    hyperspace: ['researches', 'hyperspace'],
    plasma: ['researches', 'plasma'],
    espionage: ['researches', 'espionage'],
    computer: ['researches', 'computer'],
    astrophysics: ['researches', 'astrophysics'],
    intergalactic: ['researches', 'intergalactic'],
    graviton: ['researches', 'graviton'],
    combustion_drive: ['researches', 'combustionDrive'],
    impulse_drive: ['researches', 'impulseDrive'],
    hyperspace_drive: ['researches', 'hyperspaceDrive'],
    weapons_upgrade: ['researches', 'weaponsUpgrade'],
    shielding_upgrade: ['researches', 'shieldingUpgrade'],
    armor_upgrade: ['researches', 'armorUpgrade']
  };

  private static readonly ESPIONAGE_REPORT_INFO_HEADER: string[] = ['id', 'timestamp', 'info_level'];
  private static readonly ESPIONAGE_REPORT_INFO_COMMON: string[] = ['info_level', 'galaxy', 'system', 'position', 'type', 'planet_name', 'player_name', 'player_status', 'activity', 'activity_time'];
  private static readonly ESPIONAGE_REPORT_INFO_LEVELS: string[][] = [
    ['metal', 'crystal', 'deut', 'energy'],
    ['light_fighter', 'heavy_fighter', 'cruiser', 'battleship', 'battlecruiser', 'bomber', 'destroyer', 'death_star', 'small_cargo', 'large_cargo', 'colony_ship', 'recycler', 'espionage_probe', 'solar_satellite'],
    ['rocket_launcher', 'light_laser', 'heavy_laser', 'ion_cannon', 'gauss_cannon', 'plasma_turret', 'small_shield', 'large_shield', 'anti_ballistic', 'interplanetary'],
    ['metal_mine', 'crystal_mine', 'deut_mine', 'solar_plant', 'robotics', 'shipyard', 'metal_storage', 'crystal_storage', 'deut_storage', 'research_lab', 'fusion_reactor', 'nanite', 'terraformer', 'alliance_depot', 'missile_silo', 'space_dock', 'lunar_base', 'sensor_phalanx', 'jump_gate'],
    ['energy_tech', 'laser', 'ion', 'hyperspace', 'plasma', 'espionage', 'computer', 'astrophysics', 'intergalactic', 'graviton', 'combustion_drive', 'impulse_drive', 'hyperspace_drive', 'weapons_upgrade', 'shielding_upgrade', 'armor_upgrade']
  ];

  constructor() {
    // TODO add cache
  }

  load(galaxy: number, system: number, position: number, type: CoordinateType = CoordinateType.Planet): Promise<ShardedEspionageReport | undefined> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
          `select r.* from espionage_report r join
             (select info_level, max(timestamp) as timestamp from espionage_report
             where galaxy = ${galaxy} and system = ${system} and position = ${position} and type = ${type}
             group by info_level) best
           on r.info_level = best.info_level and r.timestamp = best.timestamp
           where galaxy = ${galaxy} and system = ${system} and position = ${position} and type = ${type}
           order by r.timestamp desc`
    }).then((rawShards: any[]) => this.collectReport(rawShards));
  }

  loadC(coordinates: Coordinates): Promise<ShardedEspionageReport | undefined> {
    return this.load(coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type);
  }

  store(report: StampedEspionageReport): Promise<void> {
    let preparedData = packObject(report, SqlEspionageRepository.ESPIONAGE_REPORT_MAPPING);
    let keys = Object.keys(preparedData);
    let values = keys.map(key => valueToSQLString(preparedData[key]));
    return db.query({
      sql:
          `insert ignore into espionage_report(${keys.join(', ')})
         values (${values.join(', ')})`
    });
  }

  findForInactiveTargets(): Promise<[Coordinates, ShardedEspionageReport][]> {
    return db.query<any[]>({ // TODO define type for "raw" data
      sql:
          `select s.galaxy, s.system, s.position, r.*
           from galaxy_report_slot s
           left join
             (select r.* from espionage_report r
             join
               (select galaxy, system, position, info_level, max(timestamp) as 'timestamp'
               from espionage_report
               group by galaxy, system, position, info_level) b
             on
               r.galaxy = b.galaxy and r.system = b.system and r.position = b.position
               and r.info_level = b.info_level and r.timestamp = b.timestamp) r
           on s.galaxy = r.galaxy and s.system = r.system and s.position = r.position
           where
             (s.player_status like '%i%' or s.player_status like '%I%')
             and s.player_status not like '%РО%' and s.player_status not like '%A%'
           order by 1, 2, 3, r.timestamp desc`,
      nestTables: true
    }).then((rows: any[]) => {
      if (!rows || !rows.length) return [];
      let result: [Coordinates, ShardedEspionageReport][] = [];
      let lastCoordinates: Coordinates = extractObject(rows[0]['s'], COORDINATES_MAPPING);
      let lastIndex = 0;
      for (let i = 0; i <= rows.length; ++i) {
        let coordinates = i == rows.length ? null : extractObject(rows[i]['s'], COORDINATES_MAPPING);
        if (!sameCoordinates(lastCoordinates, coordinates)) {
          let report = this.collectReport(rows.slice(lastIndex, i).map(row => row['r']));
          if (report) {
            result.push([lastCoordinates, report]);
            lastCoordinates = coordinates;
            lastIndex = i;
          }
        }
      }
      return result;
    });
  }

  private collectReport(rawShards: any[]): ShardedEspionageReport | undefined {
    let result: ShardedEspionageReport = extractFrom(rawShards[0], SqlEspionageRepository.ESPIONAGE_REPORT_INFO_COMMON, SqlEspionageRepository.ESPIONAGE_REPORT_MAPPING);
    if (result && result.infoLevel != null) {
      result.source = [];
      let currentLevel = -1;
      for (let i = 0; i < rawShards.length; ++i) {
        let header: ShardHeader = extractFrom(rawShards[i], SqlEspionageRepository.ESPIONAGE_REPORT_INFO_HEADER, SqlEspionageRepository.ESPIONAGE_REPORT_MAPPING);
        if (currentLevel < header.infoLevel) {
          result.source.push(header);
          while (currentLevel < header.infoLevel)
            extractFrom(rawShards[i], SqlEspionageRepository.ESPIONAGE_REPORT_INFO_LEVELS[++currentLevel], SqlEspionageRepository.ESPIONAGE_REPORT_MAPPING, result);
        }
      }
      result.infoLevel = currentLevel;
      return result;
    }
  }

  deleteOldReports(): Promise<void> {
    return db.query({
      sql:
          `delete r from espionage_report r join espionage_report other on
             r.galaxy = other.galaxy
             and r.system = other.system
             and r.position = other.position
             and r.type = other.type
             and r.info_level <= other.info_level
             and r.timestamp < other.timestamp`
    });
  }
}
