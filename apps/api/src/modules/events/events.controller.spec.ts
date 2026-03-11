import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

describe('EventsController', () => {
  let controller: EventsController;
  let mockEventsService: any;

  beforeEach(async () => {
    mockEventsService = {
      processIncomingEvent: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockResolvedValue([
        { status: 'PROCESSED', count: 10 },
        { status: 'DLQ', count: 2 },
      ]),
      getDLQEvents: jest.fn().mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('deve chamar o serviço para processar um novo evento', async () => {
    const dto: CreateEventDto = {
      event_id: '123e4567-e89b-12d3-a456-426614174000',
      tenant_id: 'tenant-1',
      type: 'test.event',
      payload: { ref: '123', value: 100, currency: 'BRL', generatedAt: new Date().toISOString() },
    };

    const result = await controller.create(dto);

    expect(mockEventsService.processIncomingEvent).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ message: 'Event accepted for processing' });
  });

  it('deve retornar as métricas do sistema', async () => {
    const result = await controller.getMetrics();

    expect(mockEventsService.getMetrics).toHaveBeenCalled();
    expect(result).toEqual([
      { status: 'PROCESSED', count: 10 },
      { status: 'DLQ', count: 2 },
    ]);
  });

  it('deve retornar a lista de eventos na DLQ', async () => {
    const result = await controller.getDlq();

    expect(mockEventsService.getDLQEvents).toHaveBeenCalledWith(1, 100);
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('meta');
  });
});
