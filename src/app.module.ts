import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookModule } from './webhook/webhook.module';
import { GithubModule } from './github/github.module';
import { ReviewModule } from './review/review.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GithubModule,
    ReviewModule,
    QueueModule,
    WebhookModule,
  ],
})
export class AppModule {}