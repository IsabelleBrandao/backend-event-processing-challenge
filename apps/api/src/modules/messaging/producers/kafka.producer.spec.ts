import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { KafkaProducerService } from './kafka.producer';

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;
  let mockKafkaClient: any;

  beforeEach(async () => {
    mockKafkaClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaProducerService,
        {
          provide: 'KAFKA_SERVICE',
          useValue: mockKafkaClient,
        },
      ],
    }).compile();

    service = module.get<KafkaProducerService>(KafkaProducerService);
  });

  it('deve conectar ao Kafka no init', async () => {
    await service.onModuleInit();

    expect(mockKafkaClient.connect).toHaveBeenCalled();
  });

  it('deve enviar mensagem com sucesso', async () => {
    mockKafkaClient.emit.mockReturnValue(of({}));

    await service.produce('test.topic', { data: 'test' });

    expect(mockKafkaClient.emit).toHaveBeenCalledWith('test.topic', {
      data: 'test',
    });
  });

  it('deve tratar erro de envio sem lançar exceção', async () => {
    mockKafkaClient.emit.mockReturnValue(
      throwError(() => new Error('Kafka error')),
    );

    await expect(
      service.produce('test.topic', { data: 'test' }),
    ).resolves.not.toThrow();
  });
});
