import {PlayerContext} from './PlayerContext';
import {ServerContext} from './ServerContext';
import {UniverseContext} from './UniverseContext';

export interface OGameContext {
  getServerContext(): Promise<ServerContext>;
  getUniverseContext(): Promise<UniverseContext>;
  getPlayerContext(): Promise<PlayerContext>;
}
