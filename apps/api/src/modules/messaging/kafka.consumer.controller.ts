import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEvent, EventStatus } from '../events/entities/event.entity';
import { KafkaProducerService } from './producers/kafka.producer';

@Controller()
export class KafkaConsumerController {
  private readonly logger = new Logger(KafkaConsumerController.name);
  private readonly MOCK_URL = process.env.MOCK_INTEGRATIONS_URL || 'http://mock-integrations:4000';

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventsRepository: Repository<IntegrationEvent>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  @EventPattern('events.processing')
  async handleEventProcessing(@Payload() message: any) {
    const event = typeof message === 'string' ? JSON.parse(message) : message;
    this.logger.log(`[WORKER] Processando evento: ${event.id}`);

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      try {
        attempt++;
        const response = await fetch(`${this.MOCK_URL}/billing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event.payload),
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        success = true;
        await this.eventsRepository.update(event.id, { status: EventStatus.PROCESSED, retryCount: attempt });
        this.logger.log(`[WORKER] ✅ Sucesso! Evento ${event.id}`);

      } catch (error) {
        this.logger.warn(`[WORKER] ⚠️ Falha na tentativa ${attempt} do evento ${event.id}`);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s...
          await new Promise(res => setTimeout(res, waitTime));
        } else {
          this.logger.error(`[WORKER] ❌ Evento ${event.id} exauriu tentativas. Movendo para DLQ.`);
          await this.eventsRepository.update(event.id, { status: EventStatus.DLQ, retryCount: attempt });
          await this.kafkaProducer.produce('events.dlq', { event_id: event.id, error: error.message });
        }
      }
    }
  }
}