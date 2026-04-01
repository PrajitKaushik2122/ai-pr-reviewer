import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { REVIEW_PR_JOB } from '../queue/queue.constants';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly queueService: QueueService) {}

  async handle(headers: Record<string, string>, body: any) {
    const event = headers['x-github-event'];
    const action = body?.action;

    if (event !== 'pull_request') {
      return { ignored: true, reason: 'Not a pull_request event' };
    }

    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return { ignored: true, reason: `Unhandled action: ${action}` };
    }

    const owner = body?.repository?.owner?.login;
    const repo = body?.repository?.name;
    const pullNumber = body?.pull_request?.number;
    const installationId = body?.installation?.id;
    const title = body?.pull_request?.title ?? '';
    const description = body?.pull_request?.body ?? '';

    if (!owner || !repo || !pullNumber || !installationId) {
      throw new Error('Missing required PR payload fields');
    }

    await this.queueService.getReviewQueue().add(
      REVIEW_PR_JOB,
      {
        owner,
        repo,
        pullNumber,
        installationId,
        title,
        description,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );

    this.logger.log(`Queued review job for ${owner}/${repo}#${pullNumber}`);

    return { received: true, queued: true };
  }
}