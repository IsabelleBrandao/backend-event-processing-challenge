import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  DLQ = 'DLQ',
}

@Entity('events')
export class IntegrationEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Index()
  @Column({ type: 'varchar', length: 20, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}