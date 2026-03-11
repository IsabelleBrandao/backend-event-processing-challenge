import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Recebe e inicia o processamento assíncrono de um evento' })
  @ApiResponse({ status: 202, description: 'Evento aceite e enviado para processamento.' })
  @ApiResponse({ status: 400, description: 'Payload inválido ou malformado.' })
  async create(@Body() createEventDto: CreateEventDto) {
    await this.eventsService.processIncomingEvent(createEventDto);
    return { message: 'Event accepted for processing' };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Retorna a volumetria de eventos processados por status' })
  @ApiResponse({ status: 200, description: 'Agrupamentdo de métricas de sucesso, pendentes e falhas (DLQ).' })
  async getMetrics() {
    return this.eventsService.getMetrics();
  }

  @Get('dlq')
  @ApiOperation({ summary: 'Retorna a lista de eventos retidos na Dead Letter Queue' })
  @ApiResponse({ status: 200, description: 'Lista paginada de eventos que excederam o limite de retentativas.' })
  async getDlq() {
    return this.eventsService.getDLQEvents(1, 100); // 100 itens p/ simplificar
  }
}
