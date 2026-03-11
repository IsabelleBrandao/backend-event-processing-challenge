import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { databaseConfig } from './config/database.config';
import { MessagingModule } from './modules/messaging/messaging.module';
import { CacheModule } from './modules/cache/cache.module';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    CacheModule,
    MessagingModule,
    EventsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }