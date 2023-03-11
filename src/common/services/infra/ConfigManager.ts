import {ListenableObject, makeListenable} from '../../core/PropertyChangeEvent';
import {ConfigRepository} from '../../../uniplatform/core/types/repositories';

export class ConfigManager {
  constructor(private readonly configRepo: ConfigRepository) {
  }

  public async prepareConfig<T extends object>(defaultValue: T, name: string, profile?: string): Promise<ListenableObject<T>> {
    let stored = await this.configRepo.load<T>(name, profile);
    if (!stored)
      await this.configRepo.store(defaultValue, name, profile);
    let value = stored || defaultValue;
    let result = makeListenable(value);
    result.onAfter(null, () => this.configRepo.store(value, name, profile));
    return result;
  }
}
