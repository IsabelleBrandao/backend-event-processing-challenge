import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    try {
      await this.kafkaClient.connect();
      this.logger.log('Conectado ao Kafka com sucesso!');
    } catch (error) {
      this.logger.error('Erro ao conectar no Kafka', error);
    }
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  async produce(topic: string, message: any) {
    try {
      await lastValueFrom(this.kafkaClient.emit(topic, message));
      this.logger.log(`Mensagem enviada para o tópico: ${topic}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${topic}`, error);
    }
  }
}
