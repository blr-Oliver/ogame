import {evalFleetConfig, getFleetPageResponse, parseFleetPageForConfig} from '../../../browser/parsers/no-dom/fleet-no-dom';
import {Fetcher} from '../../core/Fetcher';
import {ServerContext} from '../../core/ServerContext';
import {initUniverseContext, UniverseContext} from '../../core/UniverseContext';

export class NoDOMUniverseContext {
  static async acquire(fetcher: Fetcher, serverContext: ServerContext): Promise<UniverseContext> {
    let body = await getFleetPageResponse(fetcher, serverContext);
    let config = evalFleetConfig(parseFleetPageForConfig(body));
    return initUniverseContext({
      maxGalaxy: config.MAX_GALAXY,
      maxSystem: config.MAX_SYSTEM,
      maxPosition: config.MAX_POSITION,
      donutGalaxy: config.DONUT_GALAXY,
      donutSystem: config.DONUT_SYSTEM,
      peacefulFleetSpeed: config.SPEEDFAKTOR_FLEET_PEACEFUL,
      warFleetSpeed: config.SPEEDFAKTOR_FLEET_WAR,
      holdingFleetSpeed: config.SPEEDFAKTOR_FLEET_HOLDING
    });
  }
}
