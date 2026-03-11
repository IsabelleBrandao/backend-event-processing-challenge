import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { IntegrationEvent, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { CacheService } from '../cache/cache.service';

/**
 * Serviço responsável por orquestrar a ingestão de eventos.
 * Implementa padrões anti-fragilidade como Idempotência baseada em Redis,
 * persistência garantida no PostgreSQL e desacoplamento do processamento via Kafka.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    @Inject('KAFKA_SERVICE') 
    private readonly kafkaClient: ClientKafka,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Recebe um evento, protege contra duplicação e envia para processamento.
   * A lógica de idempotência é distribuída (Cache-Aside Pattern).
   */
  async processIncomingEvent(createEventDto: CreateEventDto): Promise<void> {
    const { event_id, tenant_id } = createEventDto;
    const cacheKey = `ingestion_lock:${event_id}`;

    // Idempotência rápida via Redis (Previne "Double Spending" em cenários concorrentes de ingestão)
    const alreadyReceived = await this.cacheService.get(cacheKey);
    if (alreadyReceived) {
      this.logger.warn(`[API] Evento duplicado ignorado (Cache): ${event_id}`);
      return;
    }

    // Camada de Segurança Extra: Verifica no banco se o evento já existe e qual seu status
    // Isso protege o sistema caso o Redis seja limpo ou a chave expire antes da hora
    const existingEvent = await this.eventsRepository.findOne({ where: { id: event_id } });
    if (existingEvent && existingEvent.status === EventStatus.PROCESSED) {
      this.logger.warn(`[API] Evento já processado e finalizado (DB Check): ${event_id}`);
      await this.cacheService.set(cacheKey, 'true', 3600); // Re-alimenta o cache por segurança
      return;
    }

    try {
      const newEvent = this.eventsRepository.create({
        id: event_id,
        tenantId: tenant_id,
        type: createEventDto.type,
        payload: createEventDto.payload,
        status: EventStatus.PENDING,
      });

      await this.eventsRepository.save(newEvent); 
      await this.cacheService.set(cacheKey, 'true', 3600); // 1 hora de retenção

      const eventToMessage = { ...newEvent };

      // Desacopla o processamento do request original usando um Message Broker
      // A estrutura { key, value } é o padrão do NestJS para o Kafka (Partitioning por Key)
      this.kafkaClient.emit('events.processing', {
        key: tenant_id,
        value: eventToMessage,
      });

      this.logger.log(`Evento ${event_id} persistido e enviado ao Kafka.`);
      
    } catch (error) {
      if (error.code === '23505') return; // Segurança extra via DB
      this.logger.error(`Erro ao processar evento ${event_id}:`, error.stack);
      throw error; 
    }
  }

  /**
   * Retorna contagem de eventos agrupados por status para dashboards.
   */
  async getMetrics() {
    const rawData = await this.eventsRepository
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(event.id)', 'count')
      .groupBy('event.status')
      .getRawMany();

    return rawData.map(row => ({
      status: row.status,
      count: Number(row.count)
    }));
  }

  /**
   * Retorna a lista de eventos parados na DLQ para auditoria manual.
   */
  async getDLQEvents(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [items, total] = await this.eventsRepository.findAndCount({
      where: { status: EventStatus.DLQ },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}