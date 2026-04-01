import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhooks/github')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    return this.webhookService.handle(headers, body);
  }
}