# Building an Express Server for Agora Conversational AI

Conversational AI is revolutionizing how people interact with artificial intelligence. Instead of meticulously worded text prompts, users can have natural, real-time voice conversations with AI agents. This opens exciting opportunities for more intuitive and efficient interactions.

Many developers have already invested significant time building custom LLM workflows for text-based agents. Agora's Conversational AI Engine allows you to connect these existing workflows to an Agora channel, enabling real-time voice conversations without abandoning your current AI infrastructureå.

In this guide, I'll walk you through building an Express that handles the connection between your users and Agora's Conversational AI. By the end, you'll have a fully functional backend that supports real-time audio conversations with AI agents.

## Prerequisites

Before starting, make sure you have:

- Node.js (v18 or higher)
- A basic understanding of TypeScript and Express.js
- [An Agora account](https://console.agora.io/) - _first 10k minutes each month are free_
- Conversational AI service [activated on your AppID](https://console.agora.io/)

## 1. Project Setup

Let's start by creating a new Express project with TypeScript support:

```bash
mkdir agora-convo-ai-express-server
cd agora-convo-ai-express-server
npm init -y
```

Install the required dependencies:

```bash
npm install express cors dotenv agora-token
npm install -D typescript ts-node @types/express @types/cors
```

Initialize TypeScript:

```bash
npx tsc --init
```

Modify the `scripts` section in your `package.json` to use Typescript:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "ts-node src/index.ts",
  "build": "tsc"
}
```

As we go through this guide, you'll have to create new files in specific directories. So, before we start let's create these new directories.

In your project root directory, create the `src/routes/`, `components/`, and `types/` directories, and add the `.env` file:

```bash
mkdir -p src/routes src/types src/utils
touch .env
```

Your project directory should now have a structure like this:

```
├── node_modules/
├── src/
│   ├── routes/
│   ├── types/
│   └── utils/
├── .env
├── package.json
├── package-lock.json
├── tsconfig.json
```

## 2. Express Server Setup

Let's begin by setting up our main Express application.

Create the entry point `index.ts` at `src/index.ts`:

```bash
touch src/index.ts
```

For now we'll create a basic Express app, and fill it in with more functionality as we progress through the guide. I've included comments throughout the code to help you understand what's happening.

At a high level, we're setting up a new Express app, with simple router structure to handle the requests. I create a `ping` endpoint that we can use for health checks.

Add the following code to `src/index.ts`:

```typescript
import express, { Request, Response } from 'express';
import type { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app: Application = express();
const port = process.env.PORT || 3000;

// Configure global middleware
app.use(cors());
app.use(express.json());

// Create a new router instance
const router = express.Router();

// Add health check endpoint
router.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

// Mount the router
app.use('/', router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
```

> **Note:** We are loading the PORT from the environment variables, it will default to `3000` if not set in your `.env` file.

Let's test our basic Express app by running:

```bash
npm run dev
```

You should see "Server is running on port 3000" in your console. You can now visit `http://localhost:3000/ping` to verify the server is working.

## 3. Agora Conversational AI Implementation

Let's get the boring stuff out of the way first, create the files for the types needed for working with Agora's Conversational AI API:

```bash
touch src/types/client-request-types.ts
touch src/types/agora-convo-ai-types.ts
```

Add the following to `src/types/client-request-types.ts`:

```typescript
export interface InviteAgentRequest {
  requester_id: string | number;
  channel_name: string;
  rtc_codec?: number;
  input_modalities?: string[];
  output_modalities?: string[];
}

export interface RemoveAgentRequest {
  agent_id: string;
}
```

Add the following to `src/types/agora-convo-ai-types.ts`:

```typescript
export enum TTSVendor {
  Microsoft = 'microsoft',
  ElevenLabs = 'elevenlabs',
}

// Agora API response body
export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

// Agora API request body
export interface AgoraStartRequest {
  name: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid?: boolean;
    idle_timeout?: number;
    advanced_features?: {
      enable_aivad?: boolean;
      enable_bhvs?: boolean;
    };
    asr: {
      language: string;
      task?: string;
    };
    llm: {
      url?: string;
      api_key?: string;
      system_messages: Array<{
        role: string;
        content: string;
      }>;
      greeting_message: string;
      failure_message: string;
      max_history?: number;
      input_modalities?: string[];
      output_modalities?: string[];
      params: {
        model: string;
        max_tokens: number;
        temperature?: number;
        top_p?: number;
      };
    };
    vad: {
      silence_duration_ms: number;
      speech_duration_ms?: number;
      threshold?: number;
      interrupt_duration_ms?: number;
      prefix_padding_ms?: number;
    };
    tts: TTSConfig;
  };
}

export interface TTSConfig {
  vendor: TTSVendor;
  params: MicrosoftTTSParams | ElevenLabsTTSParams;
}

export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

interface MicrosoftTTSParams {
  key: string;
  region: string;
  voice_name: string;
  rate?: number;
  volume?: number;
}

interface ElevenLabsTTSParams {
  key: string;
  voice_id: string;
  model_id: string;
}
```

These new types give some insight on all the parts we'll be assembling in the next steps. We'll take the client request, and use it to configure the AgoraStartRequest and send it to Agora's Conversational AI Engine. Agora's Convo AI engine will add the agent to the conversation.

## Agent Routes

Let's implement the Conversational AI agent routes. Create the `agent` route:

```bash
touch src/routes/agent.ts
```

Start with importing express, our new types and the `agora-token library, because we'll need to generate tokens for the agent.

```typescript
import express, { Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import {
  AgoraStartRequest,
  TTSConfig,
  TTSVendor,
  AgentResponse,
} from '../types/agora-convo-ai-types';
import {
  InviteAgentRequest,
  RemoveAgentRequest,
} from '../types/client-request-types';
```

Define our router for our Agent endpoints, we'll use this later to connect these agents to our main app's router.

```typescript
// Router instance for handling AI agent-related endpoints
export const agentRouter = express.Router();
```

### Invite Agent

First we'll implement the `/agent/invite` endpoint. This route needs to handle several key tasks:

- Parse the user request and use it to create Start request for Agora's Convo AI Engine.
- Generate a token for the AI agent to access the RTC channel.
- Configure Text-to-Speech (Microsoft or ElevenLabs)
- Define the AI agent's prompt and greeting message.
- Configure the Voice Activity Detection (VAD), which controls conversation flow
- Sends the start request to Agora's Conversational AI Engine.
- Returns the response to the client that contains the AgentID from Agora's Convo AI Engine response.

```typescript
// POST /agent/invite - Start a conversation with an AI agent
agentRouter.post(
  '/invite',
  async (req: Request<{}, {}, InviteAgentRequest>, res: Response) => {
    try {
      // Extract required parameters from the request body
      const {
        requester_id,
        channel_name,
        input_modalities,
        output_modalities,
      } = req.body;

      const agentUid = process.env.AGENT_UID || 'Agent';

      // Generate a unique name for this conversation
      const channelNameBase = 'conversation';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const uniqueName = `${channelNameBase}-${timestamp}-${random}`;
      const expirationTime = Math.floor(timestamp / 1000) + 3600; // Token expires in 1 hour

      // Generate a Publisher token for the agent
      const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID!,
        process.env.AGORA_APP_CERTIFICATE!,
        channel_name,
        agentUid,
        RtcRole.PUBLISHER,
        expirationTime,
        expirationTime
      );

      // Configure Text-to-Speech settings based on environment configuration
      const ttsVendor = process.env.TTS_VENDOR as TTSVendor;
      if (!ttsVendor) {
        throw new Error('TTS_VENDOR is not set');
      }
      const ttsConfig = getTTSConfig(ttsVendor);

      // Prepare requester ID for Agora's API
      const requesterUid = requester_id.toString();

      // Define AI assistant behavior
      const systemMessage =
        'You are a helpful assistant. Pretend that the text input is audio, and you are responding to it. Speak fast, clearly, and concisely.';

      // Prepare the request body for Agora Conversation AI service
      const requestBody: AgoraStartRequest = {
        name: uniqueName,
        properties: {
          channel: channel_name,
          token: token,
          agent_rtc_uid: agentUid,
          remote_rtc_uids: [requesterUid],
          enable_string_uid: /[a-zA-Z]/.test(requesterUid),
          idle_timeout: 30,
          asr: {
            language: 'en-US',
            task: 'conversation',
          },
          llm: {
            url: process.env.LLM_URL,
            api_key: process.env.LLM_TOKEN,
            system_messages: [
              {
                role: 'system',
                content: systemMessage,
              },
            ],
            greeting_message: 'Hello! How can I assist you today?',
            failure_message: 'Please wait a moment.',
            max_history: 10,
            params: {
              model: process.env.LLM_MODEL!,
              max_tokens: 1024,
              temperature: 0.7,
              top_p: 0.95,
            },
            input_modalities: input_modalities ||
              process.env.INPUT_MODALITIES?.split(',') || ['text'],
            output_modalities: output_modalities ||
              process.env.OUTPUT_MODALITIES?.split(',') || ['text', 'audio'],
          },
          tts: ttsConfig,
          vad: {
            silence_duration_ms: 480,
            speech_duration_ms: 15000,
            threshold: 0.5,
            interrupt_duration_ms: 160,
            prefix_padding_ms: 300,
          },
          advanced_features: {
            enable_aivad: false,
            enable_bhvs: false,
          },
        },
      };

      // Make API request to Agora Conversation AI service
      const response = await fetch(
        `${process.env.AGORA_CONVO_AI_BASE_URL}/${process.env.AGORA_APP_ID}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(
              `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`
            ).toString('base64')}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.status}`);
      }

      const data: AgentResponse = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error starting conversation:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      });
    }
  }
);
```

Before proceed, we should take a moment to review the VAD settings, because they control the flow of conversation:

- `silence_duration_ms` - How long to wait for silence before ending the speaker's turn
- `speech_duration_ms` - Maximum duration allowed for a single speech segment
- `threshold` - Sensitivity to voice activity (higher values require louder speech)
- `interrupt_duration_ms` - How quickly interruptions are detected
- `prefix_padding_ms` - Audio padding captured at the beginning of speech

In the start route we use a variable `ttsConfig` that calls `getTTSConfig`. I need to call out, because normally you would have a single TTS config. For demo purposes I've built it this way to show how to implement the configs for all TTS vendors supported by Agora's Convo AI Engine.

```typescript
/**
 * Generates TTS configuration based on the specified vendor
 */
function getTTSConfig(vendor: TTSVendor): TTSConfig {
  if (vendor === TTSVendor.Microsoft) {
    if (
      !process.env.MICROSOFT_TTS_KEY ||
      !process.env.MICROSOFT_TTS_REGION ||
      !process.env.MICROSOFT_TTS_VOICE_NAME ||
      !process.env.MICROSOFT_TTS_RATE ||
      !process.env.MICROSOFT_TTS_VOLUME
    ) {
      throw new Error('Missing Microsoft TTS environment variables');
    }
    return {
      vendor: TTSVendor.Microsoft,
      params: {
        key: process.env.MICROSOFT_TTS_KEY,
        region: process.env.MICROSOFT_TTS_REGION,
        voice_name: process.env.MICROSOFT_TTS_VOICE_NAME,
        rate: parseFloat(process.env.MICROSOFT_TTS_RATE),
        volume: parseFloat(process.env.MICROSOFT_TTS_VOLUME),
      },
    };
  }

  if (vendor === TTSVendor.ElevenLabs) {
    if (
      !process.env.ELEVENLABS_API_KEY ||
      !process.env.ELEVENLABS_VOICE_ID ||
      !process.env.ELEVENLABS_MODEL_ID
    ) {
      throw new Error('Missing ElevenLabs environment variables');
    }
    return {
      vendor: TTSVendor.ElevenLabs,
      params: {
        key: process.env.ELEVENLABS_API_KEY,
        model_id: process.env.ELEVENLABS_MODEL_ID,
        voice_id: process.env.ELEVENLABS_VOICE_ID,
      },
    };
  }

  throw new Error(`Unsupported TTS vendor: ${vendor}`);
}
```

### Remove Agent

After the agent joins the conversation, we need a way to remove them from the conversation. This is where the `/agent/remove` route comes in, it takes the agentID and sends a request to the Agora's Conversational AI Engine to remove the agent from the channel.

```typescript
// POST /agent/remove - Remove an AI agent from conversation
agentRouter.post(
  '/remove',
  async (req: Request<{}, {}, RemoveAgentRequest>, res: Response) => {
    try {
      const { agent_id } = req.body;

      if (!agent_id) {
        throw new Error('agent_id is required');
      }

      // Prepare authentication for Agora API
      const plainCredential = `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`;
      const encodedCredential = Buffer.from(plainCredential).toString('base64');

      // Make API request to remove agent from conversation
      const response = await fetch(
        `${process.env.AGORA_CONVO_AI_BASE_URL}/${process.env.AGORA_APP_ID}/agents/${agent_id}/leave`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${encodedCredential}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to remove agent: ${response.status}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing agent:', error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to remove agent',
      });
    }
  }
);
```

> **Note:** The Agent routes load a number of environment variables. Make sure to set these in your `.env` file. At the end of this guide, I've included a list of all the environment variables you'll need to set.

### Add Agent Routes to Express app

Let's update our main application file to include the agent router. Open the `src/index.ts` and add:

```typescript
// Previous imports remain the same
import { agentRouter } from './routes/agent'; // Import the Agent router

// Rest of the file remains the same...

// Register route handlers
// - previous ping route remains the same.
router.use('/agent', agentRouter); // add Agent routes

// Rest of the code remains the same...
```

## Token Generation

The goal with this guide is meant to build a stand-alone micro-service that works with existing Agora client apps, so for completeness we'll implement a token generation route.

Create the token route file at `src/routes/token.ts`:

```bash
touch src/routes/token.ts
```

Expalining this code is a bit outside the scope of this guide, but if you are new to tokens i would recommend checking out my guide [Building a Token Server for Agora Applications](https://www.agora.io/en/blog/how-to-build-a-token-server-for-agora-applications-using-nodejs/).

One unique element of the token route that's worth highlighting is that if a uid or channel name are not provided, this code use 0 for the uid and generates a unique channel name. The channel name and UID are returned with every token.

Add the following code to the `src/routes/token.ts` file:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export const tokenRouter = express.Router();

/**
 * GET /token - Generate Agora RTC PUBLISHER token for client
 * Query Parameters:
 * - uid (optional): Unique user identifier
 * - channel (optional): Channel name for the communication
 */
tokenRouter.get('/', (req: Request, res: Response) => {
  console.log('Generating Agora token...');

  // Validate Agora credentials
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return res.status(500).json({ error: 'Agora credentials are not set' });
  }

  // Get query parameters
  const { uid: uidStr, channel } = req.query;

  // Validate UID if provided
  if (uidStr && !/^\d+$/.test(uidStr as string)) {
    return res
      .status(400)
      .json({ error: 'Invalid uid parameter. Must be a number' });
  }

  const uid = parseInt((uidStr as string) || '0');
  const channelName = (channel as string) || generateChannelName();
  const expirationTime = Math.floor(Date.now() / 1000) + 3600;

  try {
    console.log('Building token with UID:', uid, 'Channel:', channelName);
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID!,
      process.env.AGORA_APP_CERTIFICATE!,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime
    );

    console.log('Token generated successfully');
    res.json({
      token,
      uid: uid.toString(),
      channel: channelName,
    });
  } catch (error) {
    console.error('Error generating Agora token:', error);
    res.status(500).json({
      error: 'Failed to generate Agora token',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Generates a unique channel name
 */
function generateChannelName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ai-conversation-${timestamp}-${random}`;
}
```

Now, update our main application file to include the token router. Update `src/index.ts`:

```typescript
// Previous imports remain the same
import { tokenRouter } from './routes/token'; // Import the Token router

// Rest of the file remains the same...

// Register route handlers
// - previous ping route remains the same.
// - previous agent routes remain the same.
router.use('/token', tokenRouter); // add token routes

// Rest of the code remains the same...
```

## Validating env and requests

Let's add validation middleware to ensure proper request handling.

Create `validation.ts` at `src/utils/validation.ts`

```bash
touch src/utils/validation.ts
```

This will validate the env vars are setup right and all incoming requests to make sure they match the client request types that we defined.

Add the following code to the `src/utils/validation.ts` file:

```typescript
import { Request, Response, NextFunction } from 'express';
import {
  InviteAgentRequest,
  RemoveAgentRequest,
} from '../types/client-request-types';

/**
 * Validates required environment variables
 */
export function validateEnvironment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Common Agora credentials
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return res.status(500).json({ error: 'Agora credentials are not set' });
  }

  // Validate based on route
  if (req.path.startsWith('/agent')) {
    // Additional validations for agent routes
    if (
      !process.env.AGORA_CONVO_AI_BASE_URL ||
      !process.env.AGORA_CUSTOMER_ID ||
      !process.env.AGORA_CUSTOMER_SECRET
    ) {
      console.error('Agora Conversation AI credentials are not set');
      return res.status(500).json({
        error: 'Agora Conversation AI credentials are not set',
      });
    }

    // LLM validations
    if (!process.env.LLM_URL || !process.env.LLM_TOKEN) {
      console.error('LLM configuration is not set');
      return res.status(500).json({ error: 'LLM configuration is not set' });
    }

    // TTS validations
    const ttsVendor = process.env.TTS_VENDOR;
    if (!ttsVendor) {
      console.error('TTS_VENDOR is not set');
      return res.status(500).json({ error: 'TTS_VENDOR is not set' });
    }

    if (ttsVendor === 'microsoft') {
      if (
        !process.env.MICROSOFT_TTS_KEY ||
        !process.env.MICROSOFT_TTS_REGION ||
        !process.env.MICROSOFT_TTS_VOICE_NAME ||
        !process.env.MICROSOFT_TTS_RATE ||
        !process.env.MICROSOFT_TTS_VOLUME
      ) {
        console.error('Microsoft TTS configuration is not set');
        return res.status(500).json({
          error: 'Microsoft TTS configuration is not set',
        });
      }
    } else if (ttsVendor === 'elevenlabs') {
      if (
        !process.env.ELEVENLABS_API_KEY ||
        !process.env.ELEVENLABS_VOICE_ID ||
        !process.env.ELEVENLABS_MODEL_ID
      ) {
        console.error('ElevenLabs TTS configuration is not set');
        return res.status(500).json({
          error: 'ElevenLabs TTS configuration is not set',
        });
      }
    } else {
      return res.status(500).json({
        error: `Unsupported TTS vendor: ${ttsVendor}`,
      });
    }
  }

  next();
}

/**
 * Validates Content-Type header for POST requests
 */
export function validateContentType(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({
      error: 'Unsupported Media Type. Content-Type must be application/json',
    });
  }
  next();
}

/**
 * Validates request body based on route
 */
export function validateRequestBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip validation for non-POST requests
  if (req.method !== 'POST') {
    return next();
  }

  // Ensure request body is not empty
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  // Route-specific validation
  if (req.path === '/agent/invite') {
    const { requester_id, channel_name } = req.body as InviteAgentRequest;

    if (!requester_id) {
      return res.status(400).json({ error: 'requester_id is required' });
    }

    if (!channel_name) {
      return res.status(400).json({ error: 'channel_name is required' });
    }

    // Validate requester_id format
    if (typeof requester_id === 'string') {
      if (requester_id.trim() === '') {
        return res.status(400).json({
          error: 'requester_id cannot be empty',
        });
      }
    } else if (typeof requester_id === 'number') {
      if (!Number.isInteger(requester_id) || requester_id < 0) {
        return res.status(400).json({
          error:
            'requester_id must be a positive integer when provided as a number',
        });
      }
    } else {
      return res.status(400).json({
        error: 'requester_id must be a string or number',
      });
    }

    // Validate channel_name
    if (typeof channel_name !== 'string') {
      return res.status(400).json({
        error: 'channel_name must be a string',
      });
    }

    if (channel_name.length < 3 || channel_name.length > 64) {
      return res.status(400).json({
        error: 'channel_name length must be between 3 and 64 characters',
      });
    }
  } else if (req.path === '/agent/remove') {
    const { agent_id } = req.body as RemoveAgentRequest;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }

    if (typeof agent_id !== 'string') {
      return res.status(400).json({ error: 'agent_id must be a string' });
    }
  }

  next();
}
```

Now, update our main application file to use these validation middlewares. Update `src/index.ts`:

```typescript
// Previous imports remain the same
import {
  validateEnvironment,
  validateContentType,
  validateRequestBody,
} from './utils/validation'; // Import validation checks

// Rest of the file remains the same...

// Configure validation middleware for all routes
router.use(validateEnvironment as express.RequestHandler);
router.use(validateContentType as express.RequestHandler);
router.use(validateRequestBody as express.RequestHandler);

// Rest of the code remains the same ...
```

## Development and Testing Setup

Now that we have the core functionality in place, let's set up a proper development workflow. We'll configure nodemon to automatically restart the server when files change.

In your project's root directroy, create a `nodemon.json` file:

```bash
touch nodemon.json
```

Add the following:

```json
{
  "watch": ["src"],
  "ext": ".ts,.js",
  "ignore": [],
  "exec": "ts-node ./src/index.ts"
}
```

Update the `package.json` scripts to use Nodemon:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "nodemon",
  "build": "tsc"
}
```

Now let's run the development server:

```bash
npm run dev
```

> **Note:** Make sure your `.env` file is properly configured with all the necessary credentials. There is a complete list of environment variables at the end of this guide.

If your server is running correctly, you should see output like:

```
Server is running on port 3000
```

## Testing the Server

Before we can test our endpoints, make sure you have a client-side app running. You can use any applicaiton that implements Agora's video SDK (web, mobile, or desktop). If you don't have an app you can use [Agora's Voice Demo](https://webdemo.agora.io/basicVoiceCall/index.html), just make sure to make a token request before joining the channel.

Let's test our API endpoints using curl:

### 1. Generate a Token

```bash
curl "http://localhost:3000/token"
```

Expected response:

```json
{
  "token": "007eJxzYBB...",
  "uid": "0",
  "channel": "ai-conversation-1707654321-abc123"
}
```

### 2. Generate Token with Specific Parameters

```bash
curl "http://localhost:3000/token?channel=test-channel&uid=1234"
```

### 3. Invite an AI Agent

```bash
curl -X POST "http://localhost:3000/agent/invite" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "1234",
    "channel_name": "YOUR_CHANNEL_NAME_FROM_PREVIOUS_STEP",
    "input_modalities": ["text"],
    "output_modalities": ["text", "audio"]
  }'
```

Expected response:

```json
{
  "agent_id": "agent-123",
  "create_ts": 1234567890,
  "state": "active"
}
```

### 4. Remove an AI Agent

```bash
curl -X POST "http://localhost:3000/agent/remove" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-123"
  }'
```

Expected response:

```json
{
  "success": true
}
```

## Customizations

Agora Conversational AI Engine supports a number of customizations.

### Customizing the Agent

In the `/agent/invite` endpoint, modify the system message to customize the agents propmt:

```typescript
const systemMessage =
  "You are a technical support specialist named Alex. Your responses should be friendly but concise, focused on helping users solve their technical problems. Use simple language but don't oversimplify technical concepts.";
```

You can also update the greeting to control the initial message it speaks into the channel.

```ts
llm {
    greeting_message: 'Hello! How can I assist you today?',
    failure_message: 'Please wait a moment.',
}
```

### Customizing Speech Synthesis

Choose the right voice for your application by exploring the voice libraries:

- For Microsoft Azure TTS: Visit the [Microsoft Azure TTS Voice Gallery](https://speech.microsoft.com/portal/voicegallery)
- For ElevenLabs TTS: Explore the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)

### Fine-tuning Voice Activity Detection

Adjust VAD settings to optimize conversation flow:

```typescript
vad: {
  silence_duration_ms: 600,      // How long to wait after silence to end turn
  speech_duration_ms: 10000,     // Maximum duration for a single speech segment
  threshold: 0.6,                // Speech detection sensitivity
  interrupt_duration_ms: 200,    // How quickly interruptions are detected
  prefix_padding_ms: 400,        // Audio padding at the beginning of speech
}
```

# Complete Environment Variables Reference

Here's a complete list of environment variables for your `.env` file:

```
# Server Configuration
PORT=3000

# Agora Configuration
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate
AGORA_CONVO_AI_BASE_URL=https://api.agora.io/api/conversational-ai-agent/v2/projects
AGORA_CUSTOMER_ID=your_customer_id
AGORA_CUSTOMER_SECRET=your_customer_secret
AGENT_UID=Agent

# LLM Configuration
LLM_URL=https://api.openai.com/v1/chat/completions
LLM_TOKEN=your_openai_api_key
LLM_MODEL=gpt-4o-mini

# Input/Output Modalities
INPUT_MODALITIES=text
OUTPUT_MODALITIES=text,audio

# TTS Configuration
TTS_VENDOR=microsoft  # or elevenlabs

# Microsoft TTS Configuration
MICROSOFT_TTS_KEY=your_microsoft_tts_key
MICROSOFT_TTS_REGION=your_microsoft_tts_region
MICROSOFT_TTS_VOICE_NAME=en-US-GuyNeural
MICROSOFT_TTS_RATE=1.0
MICROSOFT_TTS_VOLUME=100.0

# ElevenLabs TTS Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_monolingual_v1
```

## Next Steps

Congratulations! You've built an Express server that integrates with Agora's Conversational AI Engine. Take this microservice and integrateit with your existing Agora backends.

For more information about [Agora's Convesational AI Engine](https://www.agora.io/en/products/conversational-ai-engine/) check out the [official documenation](https://docs.agora.io/en/).

Happy building!
