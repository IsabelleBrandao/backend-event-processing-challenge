import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Força o carregamento do .env da raiz do projeto
dotenv.config({ path: path.join(process.cwd(), '.env') });

const normalizePath = (p: string) => p.replace(/\\/g, '/');

import { IntegrationEvent } from '../modules/events/entities/event.entity';

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || 'root'),
      database: process.env.DB_NAME || 'events_db',
    }),

  entities: [IntegrationEvent],
  migrations: [normalizePath(path.join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}'))],

  migrationsRun: true,
  synchronize: process.env.DB_SYNC === 'true', // Usando a variável do seu .env
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(databaseConfig);
export default dataSource;