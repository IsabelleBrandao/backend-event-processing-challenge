import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEvent, EventStatus } from '../events/entities/event.entity';
import { KafkaProducerService } from './producers/kafka.producer';
import { IntegrationService } from '../integrations/integration.service';
import { CacheService } from '../cache/cache.service';

@Controller()
export class KafkaConsumerController {
  private readonly logger = new Logger(KafkaConsumerController.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly integrationService: IntegrationService,
    private readonly cacheService: CacheService,
  ) { }

  /**
   * Orquestra o processamento assíncrono dos eventos ingeridos.
   * Implementa verificações de idempotência e backoff exponencial para integração externa.
   */
  @EventPattern('events.processing')
  async handleEventProcessing(@Payload() event: any) {
    if (!event?.id) {
      this.logger.error('[WORKER] Payload de evento malformado recebido.');
      return;
    }

    const lockKey = `processing_lock:${event.id}`;

    // Tenta obter uma trava de exclusão mútua para o processamento
    const isNewProcessing = await this.cacheService.setNX(lockKey, 'PROCESSING', 600);
    
    if (!isNewProcessing) {
      const cachedStatus = await this.cacheService.get(lockKey);
      if (cachedStatus === 'PROCESSED' || cachedStatus === 'DLQ') {
        return;
      }
      this.logger.warn(`[WORKER] Evento ${event.id} já está em processamento ou aguardando lock.`);
      return;
    }

    try {
      const dbEvent = await this.eventsRepository.findOne({ where: { id: event.id } });

      if (!dbEvent) {
        this.logger.error(`[WORKER] Evento ${event.id} não encontrado no banco de dados.`);
        await this.cacheService.del(lockKey);
        return;
      }

      if (dbEvent.status !== EventStatus.PENDING) {
        await this.cacheService.set(lockKey, dbEvent.status, 86400);
        return;
      }

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

          await this.cacheService.set(lockKey, 'PROCESSED', 86400);

          this.logger.log(`[WORKER] Evento ${event.id} processado com sucesso.`);
          return;

        } catch (error) {
          this.logger.warn(`[WORKER] Tentativa ${attempt} falhou para o evento ${event.id}: ${error.message}`);

          if (attempt >= maxRetries) {
            await this.moveToDLQ(event, attempt, error.message);
            break;
          }

          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
        }
      }
    } catch (globalError) {
      this.logger.error(`[WORKER] Erro inesperado ao processar evento ${event.id}: ${globalError.message}`);
      await this.cacheService.del(lockKey); // Libera o lock em caso de erro fatal inesperado
    }
  }

  /**
   * Move eventos que falharam para uma Dead Letter Queue após esgotar as tentativas.
   */
  private async moveToDLQ(event: any, attempts: number, error: string) {
    if (!event?.id) return;

    await this.eventsRepository.update({ id: event.id }, {
      status: EventStatus.DLQ,
      retryCount: attempts
    });

    await this.cacheService.set(`processing_lock:${event.id}`, 'DLQ', 86400);

    await this.kafkaProducer.produce('events.dlq', {
      event_id: event.id,
      error,
      attempts,
      failedAt: new Date()
    });

    this.logger.error(`[WORKER] Evento ${event.id} movido para DLQ após ${attempts} tentativas.`);
  }
}