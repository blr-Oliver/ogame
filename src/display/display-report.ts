import {Coordinates, CoordinateType, EspionageReport, ShardedEspionageReport, ShardHeader, StampedEspionageReport} from '../model/types';
import {valueToSQLString} from '../parsers/common';
import {db} from './db';
import {extractFrom, FieldMapping, packObject} from './object-mapping';

export const ESPIONAGE_REPORT_MAPPING: FieldMapping = {
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

export const ESPIONAGE_REPORT_INFO_HEADER: string[] = [
  'id', 'timestamp', 'info_level'
];

export const ESPIONAGE_REPORT_INFO_COMMON: string[] = [
  'info_level', 'galaxy', 'system', 'position', 'type', 'planet_name', 'player_name', 'player_status', 'activity', 'activity_time'
];

export const ESPIONAGE_REPORT_INFO_LEVELS: string[][] = [
  ['metal', 'crystal', 'deut', 'energy'],
  ['light_fighter', 'heavy_fighter', 'cruiser', 'battleship', 'battlecruiser', 'bomber', 'destroyer', 'death_star', 'small_cargo', 'large_cargo', 'colony_ship', 'recycler', 'espionage_probe', 'solar_satellite'],
  ['rocket_launcher', 'light_laser', 'heavy_laser', 'ion_cannon', 'gauss_cannon', 'plasma_turret', 'small_shield', 'large_shield', 'anti_ballistic', 'interplanetary'],
  ['metal_mine', 'crystal_mine', 'deut_mine', 'solar_plant', 'robotics', 'shipyard', 'metal_storage', 'crystal_storage', 'deut_storage', 'research_lab', 'fusion_reactor', 'nanite', 'terraformer', 'alliance_depot', 'missile_silo', 'space_dock', 'lunar_base', 'sensor_phalanx', 'jump_gate'],
  ['energy_tech', 'laser', 'ion', 'hyperspace', 'plasma', 'espionage', 'computer', 'astrophysics', 'intergalactic', 'graviton', 'combustion_drive', 'impulse_drive', 'hyperspace_drive', 'weapons_upgrade', 'shielding_upgrade', 'armor_upgrade']
];

export function storeReport(report: StampedEspionageReport): Promise<void> {
  let preparedData = packObject(report, ESPIONAGE_REPORT_MAPPING);
  let keys = Object.keys(preparedData);
  let values = keys.map(key => valueToSQLString(preparedData[key]));
  return db.query({
    sql:
        `insert ignore into espionage_report(${keys.join(', ')})
         values (${values.join(', ')})`
  });
}

export function loadReportC(coordinates: Coordinates): Promise<ShardedEspionageReport> {
  return loadReport(coordinates.galaxy, coordinates.system, coordinates.position, coordinates.type);
}

export function loadReport(galaxy: number, system: number, position: number, type: CoordinateType = CoordinateType.Planet): Promise<ShardedEspionageReport> {
  return db.query({
    sql:
        `select r.* from espionage_report r join
           (select info_level, max(timestamp) as timestamp from espionage_report
           where galaxy = ${galaxy} and system = ${system} and position = ${position} and type = ${type}
           group by info_level) best
         on r.info_level = best.info_level and r.timestamp = best.timestamp
         where galaxy = ${galaxy} and system = ${system} and position = ${position} and type = ${type}
         order by r.timestamp desc`
  }).then((rawShards: any[]) => {
    if (!rawShards.length) return null;
    let result: ShardedEspionageReport = extractFrom(rawShards[0], ESPIONAGE_REPORT_INFO_COMMON, ESPIONAGE_REPORT_MAPPING);
    result.source = [];
    let currentLevel = -1;
    for (let i = 0; i < rawShards.length; ++i) {
      let header: ShardHeader = extractFrom(rawShards[i], ESPIONAGE_REPORT_INFO_HEADER, ESPIONAGE_REPORT_MAPPING);
      if (currentLevel < header.infoLevel) {
        result.source.push(header);
        while (currentLevel < header.infoLevel)
          extractFrom(rawShards[i], ESPIONAGE_REPORT_INFO_LEVELS[++currentLevel], ESPIONAGE_REPORT_MAPPING, result);
      }
    }
    result.infoLevel = currentLevel;
    return result;
  });
}

/*

DELETE r FROM espionage_report r
        JOIN
    espionage_report other ON r.galaxy = other.galaxy
        AND r.system = other.system
        AND r.position = other.position
        AND r.type = other.type
        AND r.info_level <= other.info_level
        AND r.timestamp < other.timestamp

 */
