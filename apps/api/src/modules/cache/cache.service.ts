import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

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
      // A biblioteca usa milissegundos, por isso multiplicamos por 1000
      await this.cacheManager.set(key, value, ttlSeconds * 1000);
    } catch (error) {
      this.logger.error(`Erro ao salvar cache ${key}`, error);
    }
  }

  /**
   * Tenta salvar apenas se a chave não existir. 
   * Usado para garantir que o mesmo evento não seja processado duas vezes ao mesmo tempo.
   */
  async setNX(key: string, value: any, ttlSeconds = 600): Promise<boolean> {
    try {
      const store = (this.cacheManager as any).store;

      // Se estivermos usando Redis, usamos o comando próprio dele que é mais seguro
      if (store?.client?.set) {
        const result = await store.client.set(key, value, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }

      // Se não for Redis, verificamos manualmente se a chave já existe
      const existing = await this.get(key);
      if (existing) return false;

      await this.set(key, value, ttlSeconds);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao executar setNX na chave ${key}`, error);
      return false;
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

      // Nem todo banco de cache aceita apagar vários de uma vez, por isso checamos antes
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys(pattern);
        if (keys?.length > 0) {
          await store.del(keys);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar padrão ${pattern}`, error);
    }
  }
}