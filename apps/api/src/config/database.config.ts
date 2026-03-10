import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const normalizePath = (p: string) => p.replace(/\\/g, '/');

const entitiesPath = path.join(__dirname, '..', '**', '*.entity{.ts,.js}');
const migrationsPath = path.join(
  __dirname,
  '..',
  'database',
  'migrations',
  '*{.ts,.js}',
);

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,

  entities: [normalizePath(entitiesPath)],
  migrations: [normalizePath(migrationsPath)],
  migrationsRun: true, 

  synchronize: false, 
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(databaseConfig);
export default dataSource;