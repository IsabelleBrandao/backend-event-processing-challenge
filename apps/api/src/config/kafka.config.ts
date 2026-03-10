import { ClientOptions, Transport } from '@nestjs/microservices';

export const KAFKA_TOPICS = {
  RESERVATION_CREATED: 'reservation.created',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  SEAT_RELEASED: 'seat.released',

  DLQ: {
    RESERVATION_CREATED: 'reservation.created.dlq',
    PAYMENT_CONFIRMED: 'payment.confirmed.dlq',
    SEAT_RELEASED: 'seat.released.dlq',
  },
};

export const kafkaConfig: ClientOptions = {
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'cinema-booking-client',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    },
    consumer: {
      groupId: 'cinema-booking-consumer-group',
    },
  },
};