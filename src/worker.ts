import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GithubService } from './github/github.service';
import { ReviewService } from './review/review.service';
import { REVIEW_PR_JOB, REVIEW_PR_QUEUE } from './queue/queue.constants';
import { ReviewPrProcessor } from './jobs/review-pr.processor';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const configService = app.get(ConfigService);
  const githubService = app.get(GithubService);
  const reviewService = app.get(ReviewService);

  const processor = new ReviewPrProcessor(githubService, reviewService);

  const connection = new IORedis({
    host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
    port: Number(configService.get<string>('REDIS_PORT', '6379')),
    maxRetriesPerRequest: null,
  });

  connection.on('connect', () => {
    console.log('Worker Redis connected');
  });

  connection.on('error', (err) => {
    console.error('Worker Redis error:', err);
  });

  const worker = new Worker(
    REVIEW_PR_QUEUE,
    async (job) => {
      console.log('Picked job:', job.name, job.data);

      if (job.name !== REVIEW_PR_JOB) return;

      await processor.process(job.data);
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on('ready', () => {
    console.log('BullMQ worker is ready');
  });

  worker.on('active', (job) => {
    console.log(`Job active: ${job.id}`);
  });

  worker.on('completed', (job) => {
    console.log(`Completed job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Failed job ${job?.id}:`, err);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('BullMQ worker bootstrapped');

  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  });
}

bootstrapWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});