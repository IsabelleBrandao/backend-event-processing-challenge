import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IntegrationEvent, EventStatus } from './entities/event.entity';
import { CacheService } from '../cache/cache.service';
import { CreateEventDto } from './dto/create-event.dto';

describe('EventsService', () => {
  let service: EventsService;
  let mockRepository: any;
  let mockKafkaClient: any;
  let mockCacheService: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue(true),
      findOne: jest.fn(),
    };

    mockKafkaClient = {
      emit: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(IntegrationEvent),
          useValue: mockRepository,
        },
        {
          provide: 'KAFKA_SERVICE',
          useValue: mockKafkaClient,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('deve persistir e enviar evento quando for a primeira vez (Idempotência)', async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockRepository.findOne.mockResolvedValue(null);
    
    const promptEvent: CreateEventDto = {
      event_id: '123e4567-e89b-12d3-a456-426614174000',
      tenant_id: 't-001',
      type: 'user.created',
      payload: {
        ref: '123e4567-e89b-12d3-a456-426614174000',
        value: 100,
        currency: 'USD',
        generatedAt: '2026-03-11T00:00:00.000Z',
      }
    };

    await service.processIncomingEvent(promptEvent);

    expect(mockCacheService.get).toHaveBeenCalledWith(`ingestion_lock:${promptEvent.event_id}`);
    expect(mockRepository.create).toHaveBeenCalledWith({
      id: promptEvent.event_id,
      tenantId: promptEvent.tenant_id,
      type: promptEvent.type,
      payload: promptEvent.payload,
      status: EventStatus.PENDING,
    });
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockCacheService.set).toHaveBeenCalled();
    expect(mockKafkaClient.emit).toHaveBeenCalledWith('events.processing', {
      key: promptEvent.tenant_id,
      value: expect.any(Object),
    });
  });

  it('nao deve processar novamente se o cache retornar positivo (Early Return)', async () => {
    mockCacheService.get.mockResolvedValue('true');
    
    const promptEvent: CreateEventDto = {
      event_id: '123e4567-e89b-12d3-a456-426614174000',
      tenant_id: 't-001',
      type: 'user.created',
      payload: {
        ref: '123e4567-e89b-12d3-a456-426614174000',
        value: 100,
        currency: 'USD',
        generatedAt: '2026-03-11T00:00:00.000Z',
      }
    };

    await service.processIncomingEvent(promptEvent);

    expect(mockRepository.create).not.toHaveBeenCalled();
    expect(mockKafkaClient.emit).not.toHaveBeenCalled();
  });
});
