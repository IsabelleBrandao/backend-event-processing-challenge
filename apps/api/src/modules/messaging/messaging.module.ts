import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaProducerService } from './producers/kafka.producer';
import { KafkaConsumerController } from './kafka.consumer.controller';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'cinema-api-producer',
            brokers: (process.env.KAFKA_BROKERS || 'kafka:9093').split(','),
          },
          consumer: {
            groupId: 'cinema-booking-group',
          },
        },
      },
    ]),
  ],
  controllers: [KafkaConsumerController],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class MessagingModule {}