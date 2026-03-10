import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.error(`Erro ao buscar cache ${key}`, error);
      return undefined;
    }
  }

  async set(key: string, value: any, ttlSeconds = 600): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlSeconds);
    } catch (error) {
      this.logger.error(`Erro ao salvar cache ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Erro ao deletar cache ${key}`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;

      if (store && typeof store.keys === 'function') {
        const keys = await store.keys(pattern);
        if (keys && keys.length > 0) {
          await store.del(keys);
        }
      } else {
        this.logger.warn(
          `O store de cache atual não suporta a operação 'keys' ou não foi encontrado.`,
        );
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar padrão ${pattern}`, error);
    }
  }
}
