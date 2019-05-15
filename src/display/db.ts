import {createPool, Pool, PoolConfig, QueryOptions} from 'mysql';

export interface DB {
  config: PoolConfig;
  getPool(): Pool;
  query<T>(options: QueryOptions): Promise<T>;
}

let pool: Pool = null;
export const db: DB = {
  config: {
    user: 'ogame-api',
    password: 'scrap_collector',
    database: 'ogame',
    timeout: 20000,
    connectTimeout: 5000,

    host: 'localhost',
    port: 3306,
    timezone: 'local',
    dateStrings: false,
    trace: false,
    debug: false,

    acquireTimeout: 20000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100
  },
  getPool(): Pool {
    return pool || (pool = createPool(this.config));
  },
  query<T>(options: QueryOptions): Promise<T> {
    return new Promise((resolve, reject) => {
      this.getPool().query(options, (error: any, result: T) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }
};
