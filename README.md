# Daemo AI Agent Template

A ready-to-use template for building AI agents with the [Daemo Engine](https://github.com/daemo-ai). Get started in minutes with pre-configured sample services and a clean, modular architecture.

This template includes two working example services:
- **SF 311 Data** – Query San Francisco's 311 non-emergency requests
- **FBI Crime Data** – Access the FBI Crime Data Explorer API

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A [Daemo account](https://app.daemo.ai/) (free)
- An LLM API key (Gemini, Anthropic, or OpenAI)

### 1. Install

```bash
git clone https://github.com/jimmytheguy2024/daemo-AI-agent-template-sf-311.git
cd daemo-AI-agent-template-sf-311
npm install
```

### 2. Configure

```bash
cp env.example .env
```

Edit `.env` with your keys:

```bash
# Required
DAEMO_AGENT_API_KEY=your_key_here   # Get at https://app.daemo.ai/
LLM_PROVIDER=gemini                  # or 'anthropic' or 'openai'
GEMINI_API_KEY=your_key_here         # Match your LLM_PROVIDER

# Recommended (prevents rate limits)
SF_311_APP_TOKEN=your_token_here     # https://dev.socrata.com/docs/app-tokens.html
FBI_API_KEY=your_key_here            # https://api.data.gov/signup/
```

### 3. Run the Backend

```bash
npm run dev
```

Backend API starts at `http://localhost:5000`

### 4. Run the Chat UI (Optional)

```bash
cd client
npm install
npm run dev
```

Chat interface opens at `http://localhost:3000`

## Usage

### Using the Chat UI

Simply open `http://localhost:3000` in your browser and start chatting with the AI agent. The interface supports:
- Real-time streaming responses
- Conversation history
- Example prompts to get started

### Using the API Directly

**Using curl:**
```bash
curl -X POST http://localhost:5000/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How many 311 incidents are there by type?"}'
```

**Using the helper script** (requires [httpie](https://httpie.io/) + [jq](https://jqlang.github.io/jq/)):
```bash
./ask.sh "What are the crime trends in California?"
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agent/query` | Send a query, get a response |
| POST | `/agent/query-stream` | Streaming response (SSE) |
| POST | `/agent/threads` | Create a conversation thread |
| GET | `/agent/threads` | List all threads |
| GET | `/agent/threads/:id` | Get a specific thread |
| DELETE | `/agent/threads/:id` | Delete a thread |

### Response Format

```json
{
  "success": true,
  "response": "There are 1,234 incidents of 'Street and Sidewalk Cleaning'...",
  "threadId": "abc123",
  "executionTimeMs": 150
}
```

## Project Structure

```
├── src/                       # Backend (Express + Daemo Engine)
│   ├── app.ts                 # Entry point (don't modify)
│   ├── controllers/           # API handlers (don't modify)
│   ├── middlewares/           # Express middleware (don't modify)
│   ├── services/              # ⭐ YOUR CODE GOES HERE
│   │   ├── daemoService.ts    # Register your services
│   │   ├── sf311Functions.ts  # Example: SF 311 service
│   │   ├── fbiFunctions.ts    # Example: FBI Crime service
│   │   └── *.schemas.ts       # Zod schemas for validation
│   └── utils/                 # Shared utilities
│
└── client/                    # Frontend (Next.js + shadcn/ui)
    ├── app/                   # Next.js app router
    └── components/            # React components
```

## Adding Your Own Tools

1. **Create a service class** in `src/services/`:

```typescript
// src/services/myService.ts
import { DaemoFunction } from "daemo-engine";

export class MyService {
  @DaemoFunction({
    name: "get_weather",
    description: "Get current weather for a city",
    input: WeatherInput,   // Zod schema
    output: WeatherOutput, // Zod schema
  })
  async getWeather(city: string) {
    // Your logic here
    return { temp: 72, condition: "sunny" };
  }
}
```

2. **Register it** in `src/services/daemoService.ts`:

```typescript
import { MyService } from "./myService";

// Inside initializeDaemoService():
builder.registerService(new MyService());
```

3. **Restart the server** – your new tool is ready!

## LLM Providers

Switch providers by updating `.env`:

| Provider | Variables |
|----------|-----------|
| Gemini (default) | `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` |
| Anthropic | `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` |
| OpenAI | `LLM_PROVIDER=openai` + `OPENAI_API_KEY` |

Optionally override the model:
```bash
LLM_MODEL=gemini-2.0-flash
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DAEMO_AGENT_API_KEY` | Yes | Your Daemo platform key |
| `LLM_PROVIDER` | Yes | `gemini`, `anthropic`, or `openai` |
| `GEMINI_API_KEY` | If using Gemini | Google AI API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `PORT` | No | Server port (default: 5000) |
| `DAEMO_GATEWAY_URL` | No | Daemo backend URL (default: backend.daemo.ai:50052) |
| `SF_311_APP_TOKEN` | Recommended | SF Open Data token |
| `FBI_API_KEY` | Recommended | FBI CDE API key |

## Scripts

**Backend:**
```bash
npm run dev    # Development with hot reload
npm run build  # Compile TypeScript
npm run start  # Run compiled code
```

**Frontend (in /client):**
```bash
npm run dev    # Start development server
npm run build  # Build for production
```

---

Built with [Daemo Engine](https://github.com/daemo-ai) • [Get your API key](https://app.daemo.ai/)
