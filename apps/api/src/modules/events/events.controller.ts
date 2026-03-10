import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) 
  async create(@Body() createEventDto: CreateEventDto) {
    await this.eventsService.processIncomingEvent(createEventDto);
    return { message: 'Event accepted for processing' };
  }
}