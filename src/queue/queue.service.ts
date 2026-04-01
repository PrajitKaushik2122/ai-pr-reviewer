import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { REVIEW_PR_QUEUE } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly reviewQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    this.connection = new IORedis({
      host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
      port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
      maxRetriesPerRequest: null,
    });

    this.reviewQueue = new Queue(REVIEW_PR_QUEUE, {
      connection: this.connection,
    });
  }

  getReviewQueue() {
    return this.reviewQueue;
  }

  async onModuleDestroy() {
    await this.reviewQueue.close();
    await this.connection.quit();
  }
}