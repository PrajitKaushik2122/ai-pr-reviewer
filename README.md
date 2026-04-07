# AI PR Reviewer

An automated GitHub App that reviews pull requests using Gemini AI — posting an overall summary and **inline comments on specific lines of code**, just like a human code reviewer.

![GitHub App](https://img.shields.io/badge/GitHub-App-181717?logo=github)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?logo=google&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)

---

## How It Works

1. A pull request is opened on a repository where the app is installed
2. GitHub sends a webhook event to the server
3. The job is pushed to a **BullMQ queue** (so the webhook responds instantly)
4. A worker picks up the job, fetches the PR diff from GitHub
5. The diff is sent to **Gemini 2.5 Flash** for review
6. The AI response is parsed and posted back to the PR as:
   - An **overall summary** comment
   - **Inline comments** on specific lines of changed code

```
GitHub Webhook → NestJS API → BullMQ Queue → Worker → Gemini AI → GitHub PR Comment
```

---

## Features

- **Inline diff comments** — parses unified diff patches to map AI feedback to exact line numbers
- **Async job processing** — uses BullMQ + Redis so webhook never times out
- **Smart file filtering** — skips binary files, lock files, build artifacts
- **Structured AI output** — prompts Gemini to return JSON with summary + per-line comments
- **Off-by-one tolerance** — snaps AI-generated line numbers to nearest valid diff line

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| AI Model | Google Gemini 2.5 Flash |
| Queue | BullMQ |
| Cache/Queue Store | Redis |
| GitHub Integration | Octokit + GitHub Apps API |
| Auth | GitHub App Installation Tokens |

---

## Project Structure

```
src/
├── github/          # GitHub API integration (Octokit)
├── review/          # Gemini AI review logic
├── jobs/            # BullMQ job processor
├── queue/           # Queue setup and constants
├── webhook/         # GitHub webhook receiver
├── main.ts          # NestJS API server entry
└── worker.ts        # BullMQ worker entry
```

---

## Local Setup

### Prerequisites

- Node.js 20+
- Redis running locally
- A GitHub App ([create one here](https://github.com/settings/apps/new))
- Gemini API key ([get one here](https://aistudio.google.com/apikey))
- ngrok (for local webhook testing)

### 1. Clone the repo

```bash
git clone https://github.com/PrajitKaushik2122/ai-pr-reviewer.git
cd ai-pr-reviewer/ai-pr-reviewer
npm install
```

### 2. Create `.env` file

```env
GEMINI_API_KEY=your_gemini_api_key
GITHUB_APP_ID=your_github_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PORT=3000
```

### 3. GitHub App permissions

In your GitHub App settings, set:
- **Pull requests** → Read & Write
- **Issues** → Read & Write

Subscribe to events:
- **Pull request**

### 4. Run the app

```bash
# Terminal 1 — API server
npm run start:dev

# Terminal 2 — Worker
npm run start:worker

# Terminal 3 — Expose to GitHub via ngrok
ngrok http 3000
```

Set your GitHub App webhook URL to the ngrok URL + `/webhook`.

---

## How Inline Comments Work

GitHub only allows comments on lines that appear in the PR diff. The app:

1. Parses the `@@` hunk headers in each file's patch to determine which line numbers correspond to added lines (`+` lines)
2. Passes the diff to Gemini with instructions to return comments with exact file paths and line numbers
3. Validates and snaps each AI-generated line number to the nearest valid diff line
4. Posts everything as a single `pulls.createReview` call with inline comments attached

---

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GITHUB_APP_ID` | Your GitHub App's ID |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (newlines as `\n`) |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret set in GitHub App settings |
| `REDIS_HOST` | Redis host (default: `127.0.0.1`) |
| `REDIS_PORT` | Redis port (default: `6379`) |
| `PORT` | Server port (default: `3000`) |

---

## License

MIT
