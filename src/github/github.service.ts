import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { InlineComment } from '../review/review.service';

@Injectable()
export class GithubService {
  constructor(private readonly configService: ConfigService) {}

  private async getOctokitForInstallation(installationId: number) {
    const appId = this.configService.get<string>('GITHUB_APP_ID');
    const privateKey = this.configService
      .get<string>('GITHUB_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!appId || !privateKey) {
      throw new Error('Missing GitHub app configuration');
    }

    const auth = createAppAuth({ appId, privateKey, installationId });
    const installationAuth = await auth({ type: 'installation' });

    return new Octokit({ auth: installationAuth.token });
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    installationId: number,
  ) {
    const octokit = await this.getOctokitForInstallation(installationId);

    const response = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    return response.data;
  }

  async postPullRequestReview(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    inlineComments: InlineComment[],
    installationId: number,
  ) {
    const octokit = await this.getOctokitForInstallation(installationId);

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      body,
      event: 'COMMENT',
      comments: inlineComments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    });
  }
}