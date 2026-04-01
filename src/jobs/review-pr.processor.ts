import { Logger } from '@nestjs/common';
import { GithubService } from '../github/github.service';
import { ReviewService, InlineComment } from '../review/review.service';

type ReviewPrJobData = {
  owner: string;
  repo: string;
  pullNumber: number;
  installationId: number;
  title: string;
  description: string;
};

function extractValidLines(patch: string): Set<number> {
  const validLines = new Set<number>();
  let currentLine = 0;

  for (const line of patch.split('\n')) {
    const hunkHeader = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkHeader) {
      currentLine = parseInt(hunkHeader[1], 10);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      validLines.add(currentLine);
      currentLine++;
    } else if (!line.startsWith('-')) {
      currentLine++;
    }
  }

  return validLines;
}

export class ReviewPrProcessor {
  private readonly logger = new Logger(ReviewPrProcessor.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly reviewService: ReviewService,
  ) {}

  async process(data: ReviewPrJobData) {
    const { owner, repo, pullNumber, installationId, title, description } = data;

    this.logger.log(`Processing ${owner}/${repo}#${pullNumber}`);

    const files = await this.githubService.getPullRequestFiles(
      owner,
      repo,
      pullNumber,
      installationId,
    );

    const filteredFiles = files.filter((file) => {
      const filename = file.filename || '';
      if (!file.patch) return false;
      if (filename.includes('dist/')) return false;
      if (filename.includes('build/')) return false;
      if (filename.includes('coverage/')) return false;
      if (filename.endsWith('.lock')) return false;
      if (/\.(png|jpg|jpeg|svg|gif)$/.test(filename)) return false;
      return true;
    });

    if (filteredFiles.length === 0) {
      await this.githubService.postPullRequestReview(
        owner,
        repo,
        pullNumber,
        '## AI Review Summary\n\nNo reviewable code changes were found in this PR.',
        [],
        installationId,
      );
      return;
    }

    const { summary, inlineComments } = await this.reviewService.reviewPullRequest({
      title,
      description,
      owner,
      repo,
      pullNumber,
      files: filteredFiles,
    });

    const validLineMap = new Map<string, Set<number>>();
    for (const file of filteredFiles) {
      if (file.patch) {
        validLineMap.set(file.filename, extractValidLines(file.patch));
      }
    }

    console.log(
      'VALID LINE MAP:',
      [...validLineMap.entries()].map(([f, lines]) => ({ file: f, lines: [...lines] })),
    );

    console.log('RAW INLINE COMMENTS:', JSON.stringify(inlineComments, null, 2));

    const validComments = inlineComments
      .map((c): InlineComment | null => {
        const validLines = validLineMap.get(c.path);
        if (!validLines || validLines.size === 0) return null;

        if (validLines.has(c.line)) return c;

        const nearest = [...validLines].find((l) => Math.abs(l - c.line) <= 3);
        if (nearest !== undefined) return { ...c, line: nearest };

        return null;
      })
      .filter((c): c is InlineComment => c !== null);

    this.logger.log(
      `Inline comments: ${inlineComments.length} generated, ${validComments.length} valid`,
    );

    await this.githubService.postPullRequestReview(
      owner,
      repo,
      pullNumber,
      summary,
      validComments,
      installationId,
    );

    this.logger.log(`Posted review for ${owner}/${repo}#${pullNumber}`);
  }
}