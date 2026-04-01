import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export type InlineComment = {
  path: string;
  line: number;
  body: string;
};

export type ReviewResult = {
  summary: string;
  inlineComments: InlineComment[];
};

type ChangedFile = {
  filename: string;
  patch?: string;
  status?: string;
};

type ReviewInput = {
  title: string;
  description: string;
  owner: string;
  repo: string;
  pullNumber: number;
  files: ChangedFile[];
};

@Injectable()
export class ReviewService {
  private readonly client: GoogleGenAI;
  private readonly model = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    this.client = new GoogleGenAI({ apiKey });
  }

  async reviewPullRequest(input: ReviewInput): Promise<ReviewResult> {
    const fileText = input.files
      .slice(0, 10)
      .map((file) => {
        const patch = file.patch ?? 'No patch available';
        const status = file.status ?? 'unknown';
        return [
          `FILE: ${file.filename}`,
          `STATUS: ${status}`,
          'PATCH:',
          patch,
        ].join('\n');
      })
      .join('\n\n---\n\n');

    const prompt = `
You are a senior software engineer reviewing a GitHub pull request.

Review ONLY the provided diff. Do NOT assume code not shown. Do NOT hallucinate missing context.

Focus on:
- correctness
- security
- performance
- maintainability

Avoid low-value style nitpicks, repeating obvious changes, or generic praise.

Return ONLY valid JSON with no markdown, no backticks, no explanation. Use this exact structure:
{
  "summary": "## Overall Assessment\\n...\\n\\n## Key Findings\\n- finding\\n\\n## Suggestions\\n- suggestion",
  "inlineComments": [
    {
      "path": "exact/file/path.ts",
      "line": 42,
      "body": "Concise actionable comment about this specific line."
    }
  ]
}

Rules for inlineComments:
- "path" must exactly match the FILE path shown after "FILE:" in the diff (no b/ prefix)
- "line" must be a line number from the diff that starts with "+" (added lines only)
- Parse the @@ -x,y +startLine,count @@ headers to compute correct line numbers
- Only comment on lines that genuinely need attention
- If no inline comments are warranted, return an empty array []
- Keep each comment under 100 words

Repository: ${input.owner}/${input.repo}
PR Number: #${input.pullNumber}
PR Title: ${input.title}
PR Description: ${input.description || 'No description provided'}

Changed files:
${fileText}
`;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
    });

    const raw = response.text?.trim() ?? '';

    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      return {
        summary: `## AI Review Summary\n\n${parsed.summary ?? ''}`,
        inlineComments: Array.isArray(parsed.inlineComments)
          ? parsed.inlineComments
          : [],
      };
    } catch {
      return {
        summary: `## AI Review Summary\n\n${raw}`,
        inlineComments: [],
      };
    }
  }
}