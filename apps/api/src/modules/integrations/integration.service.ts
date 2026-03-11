import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly MOCK_URL = process.env.MOCK_INTEGRATIONS_URL || 'http://mock-integrations:4000';

  async processBilling(payload: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.MOCK_URL}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`External API Error: ${response.status}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Falha na integração externa:', error.message);
      throw error;
    }
  }
}