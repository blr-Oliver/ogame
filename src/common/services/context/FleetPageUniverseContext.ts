import {initUniverseContext, UniverseContext} from 'ogame-core/context/UniverseContext';
import {FleetPageInfoLoader} from '../operations/FleetPageInfoLoader';

export class FleetPageUniverseContext {
  static async acquire(loader: FleetPageInfoLoader): Promise<UniverseContext> {
    const info = await loader.load();
    return initUniverseContext({
      maxGalaxy: info.globalVars['MAX_GALAXY'],
      maxSystem: info.globalVars['MAX_SYSTEM'],
      maxPosition: info.globalVars['MAX_POSITION'],
      donutGalaxy: info.globalVars['DONUT_GALAXY'],
      donutSystem: info.globalVars['DONUT_SYSTEM'],
      peacefulFleetSpeed: +info.meta['ogame-universe-speed-fleet-peaceful'],
      warFleetSpeed: +info.meta['ogame-universe-speed-fleet-war'],
      holdingFleetSpeed: +info.meta['ogame-universe-speed-fleet-holding'],
      economyFactor: +info.meta['ogame-universe-speed'],
      name: info.meta['ogame-universe-name']
    });
  }
}