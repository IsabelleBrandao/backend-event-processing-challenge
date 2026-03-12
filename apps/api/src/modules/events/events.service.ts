import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { IntegrationEvent, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientKafka,
    private readonly cacheService: CacheService,
  ) { }

  /**
   * Processa a entrada de novos eventos garantindo a idempotência e persistência.
   */
  async processIncomingEvent(createEventDto: CreateEventDto): Promise<void> {
    const { event_id, tenant_id } = createEventDto;
    const cacheKey = `ingestion_lock:${event_id}`;

    // Tenta criar uma trava no cache para evitar processamento duplicado
    const isNewRequest = await this.cacheService.setNX(cacheKey, 'processing', 3600);

    if (!isNewRequest) {
      this.logger.warn(`[API] Requisição duplicada ou em curso: ${event_id}`);
      return;
    }

    try {
      // Verifica se o evento já existe no banco (segurança extra caso o cache expire)
      const existingEvent = await this.eventsRepository.findOne({ where: { id: event_id } });
      
      let eventEntity = existingEvent;

      if (existingEvent) {
        if (existingEvent.status === EventStatus.PROCESSED) {
          // Se já foi processado, atualizamos o cache e encerramos
          await this.cacheService.set(cacheKey, 'PROCESSED', 86400);
          return;
        }
        this.logger.log(`[API] Evento ${event_id} já existe no banco com status ${existingEvent.status}. Re-tentando envio.`);
      } else {
        // Se é um evento novo, cria e persiste
        eventEntity = this.eventsRepository.create({
          id: event_id,
          tenantId: tenant_id,
          type: createEventDto.type,
          payload: createEventDto.payload,
          status: EventStatus.PENDING,
        });

        try {
          await this.eventsRepository.save(eventEntity);
        } catch (dbError) {
          // Se houver erro de chave duplicada aqui, significa que outra thread salvou primeiro
          if (dbError.code === '23505') {
            const reloadedEvent = await this.eventsRepository.findOne({ where: { id: event_id } });
            if (reloadedEvent && reloadedEvent.status === EventStatus.PROCESSED) {
              return;
            }
            eventEntity = reloadedEvent;
          } else {
            throw dbError;
          }
        }
      }

      // Envia para o Kafka e aguarda a confirmação de recebimento do broker
      try {
        await new Promise((resolve, reject) => {
          this.kafkaClient.emit('events.processing', {
            key: eventEntity.tenantId,
            value: {
              id: eventEntity.id,
              tenant_id: eventEntity.tenantId,
              payload: eventEntity.payload,
              type: eventEntity.type,
            }
          }).subscribe({
            next: () => resolve(true),
            error: (err) => reject(err),
          });
        });

        this.logger.log(`[API] Evento ${event_id} enviado para o broker.`);
      } catch (kafkaError) {
        // Se o broker falhar, o evento fica como PENDING para futura reconciliação
        this.logger.error(`[API] Falha ao enviar para o broker: ${event_id}`);
        throw kafkaError;
      }

    } catch (error) {
      // Remove a trava do cache para permitir que o cliente tente enviar novamente
      await this.cacheService.del(cacheKey);
      this.logger.error(`[API] Erro ao processar evento ${event_id}`, error.stack);
      throw error;
    }
  }

  /**
   * Retorna métricas consolidadas por status.
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
   * Lista eventos que falharam e estão na DLQ para auditoria.
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