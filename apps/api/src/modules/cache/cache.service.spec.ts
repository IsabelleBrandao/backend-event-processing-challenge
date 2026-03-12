import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockCacheManager: any;

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      store: {
        keys: jest.fn(),
        del: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('deve recuperar valor do cache', async () => {
    mockCacheManager.get.mockResolvedValue('cached-value');

    const result = await service.get('test-key');

    expect(result).toBe('cached-value');
    expect(mockCacheManager.get).toHaveBeenCalledWith('test-key');
  });

  it('deve salvar valor no cache com conversão de TTL para milissegundos', async () => {
    await service.set('test-key', 'value', 100);

    expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'value', 100000); // 100 * 1000
  });

  it('deve deletar chave do cache', async () => {
    await service.del('test-key');

    expect(mockCacheManager.del).toHaveBeenCalledWith('test-key');
  });

  describe('setNX', () => {
    it('deve retornar true se conseguir adquirir o lock usando store nativo', async () => {
      mockCacheManager.store.client = {
        set: jest.fn().mockResolvedValue('OK'),
      };

      const result = await service.setNX('lock', 'val', 10);

      expect(result).toBe(true);
      expect(mockCacheManager.store.client.set).toHaveBeenCalledWith('lock', 'val', 'EX', 10, 'NX');
    });

    it('deve retornar false se o lock ja existir usando fallback', async () => {
      mockCacheManager.get.mockResolvedValue('existing');

      const result = await service.setNX('lock', 'val', 10);

      expect(result).toBe(false);
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  it('deve deletar chaves por padrão', async () => {
    mockCacheManager.store.keys.mockResolvedValue(['key1', 'key2']);

    await service.delPattern('session:*');

    expect(mockCacheManager.store.keys).toHaveBeenCalledWith('session:*');
    expect(mockCacheManager.store.del).toHaveBeenCalledWith(['key1', 'key2']);
  });
});
