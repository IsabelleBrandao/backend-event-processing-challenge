import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { IntegrationEvent } from './entities/event.entity';
import { IntegrationService } from '../integrations/integration.service'; 
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationEvent]),
    CacheModule,
  ],
  providers: [EventsService, IntegrationService],
  controllers: [EventsController],
  exports: [EventsService, IntegrationService, TypeOrmModule], 
})
export class EventsModule {}