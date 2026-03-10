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

  it('deve salvar valor no cache', async () => {
    await service.set('test-key', 'value', 100);

    expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'value', 100);
  });

  it('deve deletar chave do cache', async () => {
    await service.del('test-key');

    expect(mockCacheManager.del).toHaveBeenCalledWith('test-key');
  });

  it('deve deletar chaves por padrão', async () => {
    mockCacheManager.store.keys.mockResolvedValue(['key1', 'key2']);

    await service.delPattern('session:*');

    expect(mockCacheManager.store.keys).toHaveBeenCalledWith('session:*');
    expect(mockCacheManager.store.del).toHaveBeenCalledWith(['key1', 'key2']);
  });
});
