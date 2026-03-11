import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEvent, EventStatus } from '../events/entities/event.entity';
import { KafkaProducerService } from './producers/kafka.producer';
import { IntegrationService } from '../integrations/integration.service';
import { CacheService } from '../cache/cache.service';

/**
 * Controller responsável por ouvir os eventos do Kafka de forma assíncrona.
 * Implementa resiliência através de Idempotência, Exponential Backoff e DLQ
 * protegendo o sistema de duplicações e sobrecargas no webhook externo.
 */
@Controller()
export class KafkaConsumerController {
  private readonly logger = new Logger(KafkaConsumerController.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly integrationService: IntegrationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Consome o tópico onde a API postou as mensagens.
   * Evita "Double Processing" usando Redis (Cache-Aside pattern).
   */
  @EventPattern('events.processing')
  async handleEventProcessing(@Payload() event: any) {
    if (!event || !event.id) {
      this.logger.error('[WORKER] Recebido evento inválido ou malformado do Kafka.');
      return;
    }

    const lockKey = `processing_lock:${event.id}`;
    
    // Idempotência no Worker: Evita processar se já foi concluído ou se já está na DLQ
    const status = await this.cacheService.get(lockKey);
    if (status === 'PROCESSED' || status === 'DLQ') return;

    this.logger.log(`[WORKER] Iniciando processamento: ${event.id}`);

    const maxRetries = 5; 
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        await this.integrationService.processBilling(event.payload);

        await this.eventsRepository.update({ id: event.id }, { 
          status: EventStatus.PROCESSED, 
          retryCount: attempt - 1,
          processedAt: new Date()
        });
        
        await this.cacheService.set(lockKey, 'PROCESSED', 86400); // 24h
        this.logger.log(`[WORKER] Evento ${event.id} processado com sucesso.`);
        return;

      } catch (error) {
        this.logger.warn(`[WORKER] Tentativa ${attempt} falhou para ${event.id}: ${error.message}`);
        
        if (attempt >= maxRetries) {
          await this.moveToDLQ(event, attempt, error.message);
          break;
        }
        
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  /**
   * Move o evento rejeitado para outro tópico para proteção do ecossistema principal.
   */
  private async moveToDLQ(event: any, attempts: number, error: string) {
    if (!event || !event.id) return;

    this.logger.error(`[WORKER] Evento ${event.id} esgotou retries e foi movido para DLQ.`);
    await this.eventsRepository.update({ id: event.id }, { 
      status: EventStatus.DLQ, 
      retryCount: attempts 
    });
    
    await this.cacheService.set(`processing_lock:${event.id}`, 'DLQ', 86400); // Trava como DLQ por 24h
    await this.kafkaProducer.produce('events.dlq', { event_id: event.id, error });
  }
}