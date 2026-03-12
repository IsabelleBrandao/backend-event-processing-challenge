import { IsString, IsUUID, IsObject, IsNotEmpty, IsNumber, IsISO8601, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EcommercePayloadDto {
  @ApiProperty({ example: '74738ff5-5367-4633-9121-510075d045c4', description: 'Referência única da transação no sistema de origem (UUID v4)' })
  @IsUUID('all')
  @IsNotEmpty()
  ref!: string;

  @ApiProperty({ example: 250.50, description: 'Valor monetário do evento' })
  @IsNotEmpty()
  @IsNumber()
  value!: number;

  @ApiProperty({ example: 'BRL', description: 'Moeda da transação' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({ example: '2026-03-11T12:00:00.000Z', description: 'Timestamp original da ocorrência do evento' })
  @IsISO8601()
  @IsNotEmpty()
  generatedAt!: string;
}

export class CreateEventDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID único para garantir idempotência (UUID v4)' })
  @IsUUID('all')
  @IsNotEmpty()
  event_id!: string;

  @ApiProperty({ example: 'tenant-01', description: 'Identificador do cliente/tenant' })
  @IsString()
  @IsNotEmpty()
  tenant_id!: string;

  @ApiProperty({ example: 'ecommerce.payment_confirmed', description: 'Tipo do evento para roteamento e lógica de negócio' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ 
    type: () => EcommercePayloadDto, 
    description: 'Dados específicos do evento',
    example: {
      ref: '74738ff5-5367-4633-9121-510075d045c4',
      value: 250.50,
      currency: 'BRL',
      generatedAt: '2026-03-11T12:00:00.000Z'
    }
  })
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => EcommercePayloadDto)
  payload!: EcommercePayloadDto;
}