import { Test, TestingModule } from '@nestjs/testing';
import { KafkaConsumerController } from './kafka.consumer.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntegrationEvent, EventStatus } from '../events/entities/event.entity';
import { KafkaProducerService } from './producers/kafka.producer';
import { IntegrationService } from '../integrations/integration.service';
import { CacheService } from '../cache/cache.service';

describe('KafkaConsumerController', () => {
  let controller: KafkaConsumerController;
  let mockRepository: any;
  let mockKafkaProducer: any;
  let mockIntegrationService: any;
  let mockCacheService: any;

  beforeEach(async () => {
    mockRepository = {
      update: jest.fn().mockResolvedValue(true),
    };

    mockKafkaProducer = {
      produce: jest.fn().mockResolvedValue(true),
    };

    mockIntegrationService = {
      processBilling: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KafkaConsumerController],
      providers: [
        {
          provide: getRepositoryToken(IntegrationEvent),
          useValue: mockRepository,
        },
        {
          provide: KafkaProducerService,
          useValue: mockKafkaProducer,
        },
        {
          provide: IntegrationService,
          useValue: mockIntegrationService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    controller = module.get<KafkaConsumerController>(KafkaConsumerController);
  });

  it('deve processar o evento com sucesso logo na primeira tentativa', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockIntegrationService.processBilling.mockResolvedValue(true);

    const event = { id: 'evt-1', payload: {} };
    await controller.handleEventProcessing(event);

    expect(mockIntegrationService.processBilling).toHaveBeenCalledTimes(1);
    expect(mockRepository.update).toHaveBeenCalledWith({ id: 'evt-1' }, {
      status: EventStatus.PROCESSED,
      retryCount: 0,
      processedAt: expect.any(Date),
    });
    expect(mockCacheService.set).toHaveBeenCalledWith(`processing_lock:${event.id}`, 'PROCESSED', 86400);
  });

  it('se as 5 tentativas falharem, deve enviar para DLQ', async () => {
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => cb());
    
    mockCacheService.get.mockResolvedValue(null);
    mockIntegrationService.processBilling.mockRejectedValue(new Error('API Fora'));

    const event = { id: 'evt-dlq', payload: {} };
    await controller.handleEventProcessing(event);

    expect(mockIntegrationService.processBilling).toHaveBeenCalledTimes(5);
    expect(mockRepository.update).toHaveBeenCalledWith({ id: 'evt-dlq' }, {
      status: EventStatus.DLQ,
      retryCount: 5,
    });
    expect(mockCacheService.set).toHaveBeenCalledWith(`processing_lock:${event.id}`, 'DLQ', 86400);
    expect(mockKafkaProducer.produce).toHaveBeenCalledWith('events.dlq', {
      event_id: 'evt-dlq',
      error: 'API Fora',
    });
  });
});
