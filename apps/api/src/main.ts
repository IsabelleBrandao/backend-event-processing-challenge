import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { kafkaConfig } from './config/kafka.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter() 
  );

  app.connectMicroservice(kafkaConfig);
  await app.startAllMicroservices();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Nexly Event Processing API')
    .setDescription('High Concurrency Event Ingestion API with Kafka, Retry Pattern, and DLQ.')
    .setVersion('1.0')
    .addTag('Events', 'Endpoints para ingestão de eventos de integração')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Aplicação rodando na porta ${port} utilizando FASTIFY`);
  logger.log(`Swagger disponível em http://localhost:${port}/api-docs`);
}

bootstrap();