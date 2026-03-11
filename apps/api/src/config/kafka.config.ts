import { ClientOptions, Transport } from '@nestjs/microservices';

export const KAFKA_TOPICS = {
  PROCESSING: 'events.processing',
  DLQ: 'events.dlq',
};

export const kafkaConfig: ClientOptions = {
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'event-processor-api',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    },
    consumer: {
      groupId: 'event-processor-group',
    },
  },
};