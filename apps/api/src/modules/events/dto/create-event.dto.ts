import { IsString, IsUUID, IsObject, IsNotEmpty, IsNumber, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EcommercePayloadDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  ref!: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  value!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty()
  @IsISO8601()
  @IsNotEmpty()
  generatedAt!: string;
}

export class CreateEventDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  event_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenant_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ type: () => EcommercePayloadDto })
  @IsObject()
  @IsNotEmpty()
  @Type(() => EcommercePayloadDto)
  payload!: EcommercePayloadDto;
}