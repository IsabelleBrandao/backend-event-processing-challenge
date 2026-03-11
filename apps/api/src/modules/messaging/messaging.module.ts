import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaProducerService } from './producers/kafka.producer';
import { KafkaConsumerController } from './kafka.consumer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEvent } from '../events/entities/event.entity';
import { IntegrationService } from '../integrations/integration.service';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [
    CacheModule,
    TypeOrmModule.forFeature([IntegrationEvent]),
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'nexly-event-processor',
            brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
          },
          consumer: {
            groupId: 'events-processor-group',
          },
        },
      },
    ]),
  ],
  controllers: [KafkaConsumerController],
  providers: [
    KafkaProducerService,
    IntegrationService
  ],
  exports: [KafkaProducerService, ClientsModule],
})
export class MessagingModule {}