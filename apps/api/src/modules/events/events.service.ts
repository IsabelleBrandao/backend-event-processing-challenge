import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { IntegrationEvent, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    @Inject('KAFKA_SERVICE') 
    private readonly kafkaClient: ClientKafka,
  ) {}

  async processIncomingEvent(createEventDto: CreateEventDto): Promise<void> {
    const { event_id, tenant_id, type, payload } = createEventDto;

    try {
      const newEvent = this.eventsRepository.create({
        id: event_id,
        tenantId: tenant_id,
        type: type,
        payload: payload,
        status: EventStatus.PENDING,
      });

      await this.eventsRepository.save(newEvent);
      this.logger.log(`Evento ${event_id} persistido com sucesso.`);

      this.kafkaClient.emit('events.processing', {
        key: tenant_id, 
        value: JSON.stringify(newEvent),
      });

      this.logger.log(`Evento ${event_id} enfileirado no Kafka.`);
      
    } catch (error) {
      if (error.code === '23505') {
        this.logger.warn(`Evento duplicado recebido e ignorado: ${event_id}`);
        return;
      }

      this.logger.error(`Erro ao persistir evento ${event_id}:`, error.stack);
      throw error; 
    }
  }
}