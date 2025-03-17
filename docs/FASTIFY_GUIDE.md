# Building an Agora Conversational AI Backend with Fastify

Conversational AI is revolutionizing how people interact with artificial intelligence. Instead of carefully crafting text prompts, users can have natural, real-time voice conversations with AI agents. This opens exciting opportunities for more intuitive and efficient interactions.

Many developers have already invested significant time building custom LLM workflows for text-based agents. Agora's Conversational AI Engine allows you to connect these existing workflows to an Agora channel, enabling real-time voice conversations without abandoning your current AI infrastructure.

In this guide, we'll build a Fastify backend server that handles the connection between your users and Agora's Conversational AI. By the end, you'll have a production-ready backend that can power voice-based AI conversations for your applications.

## Prerequisites

Before getting started, make sure you have:

- Node.js (v18 or higher)
- Basic knowledge of TypeScript and Fastify
- [An Agora account](https://console.agora.io/) - _first 10k minutes each month are free_
- Conversational AI service [activated on your AppID](https://console.agora.io/)

## Project Setup

Let's set up our Fastify server with TypeScript. We'll create a new project and install the necessary dependencies.

First, create a new directory and initialize the project:

```bash
mkdir agora-convo-ai-server
cd agora-convo-ai-server
npm init -y
```

Next, install the required dependencies:

```bash
npm install fastify @fastify/cors dotenv agora-token
npm install --save-dev typescript ts-node nodemon @types/node
```

Initialize TypeScript in your project:

Create a `tsconfig.json` file in the root directory:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

Now, update the `scripts` section in your `package.json` to use Typescript:

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

## Fastify Server Setup

Let's implement our server's entry point for our Fastify instance including a basic health check endpoint.

Create the file `src/index.ts`:

```bash
touch src/index.ts
```

For now we'll create a basic Fastify app, and fill it in with more functionality as we progress through the guide. I've included comments throughout the code to help you understand what's happening.

At a high level, we're setting up a new Fastify app, with simple router structure to handle the requests. I create a `ping` endpoint that we can use for health checks.

Add the following code to `src/index.ts`:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Fastify instance
const fastify = Fastify({
  logger: true,
});

// Register CORS to allow cross-origin requests (important for web clients)
fastify.register(cors, {
  origin: '*', // In production, restrict this to your frontend domain
});

// Define a health check route
fastify.get('/ping', async () => {
  return { message: 'pong' };
});

// Start the server
const start = async () => {
  try {
    // Use provided port or default to 3030
    const port = parseInt(process.env.PORT || '3030');

    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server is running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

> **Note:** We are loading the PORT from the environment variables, it will default to `3030` if not set in your `.env` file.

Let's test our basic Fastify app by running:

```bash
npm run dev
```

You should see "Server is running on port 3030" in your console. You can now visit `http://localhost:3030/ping` to verify the server is working.

## Agora Conversational AI Routes

The real power of our server comes from the Agora Conversational AI integration. Let's get the boring stuff out of the way first, create the files for the types needed for working with Agora's Conversational AI API:

```bash
touch src/types/agora-convo-ai-types.ts
```

Add the following interfaces to `src/types/agora-convo-ai-types.ts`:

```typescript
export enum TTSVendor {
  Microsoft = 'microsoft',
  ElevenLabs = 'elevenlabs',
}

// Response from Agora when adding an agent to a channel
export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

// Request body for Agora's API to join a conversation
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

export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}
```

Now, let's define the client request types.

Create `client-request-types.ts`:

```bash
touch src/types/client-request-types.ts
```

Add the following interfaces to `src/types/client-request-types.ts`:

```typescript
export interface InviteAgentRequest {
  requester_id: string | number;
  channel_name: string;
  input_modalities?: string[];
  output_modalities?: string[];
}

export interface RemoveAgentRequest {
  agent_id: string;
}
```

These new types give some insight on all the parts we'll be assembling in the next steps. We'll take the client request, and use it to configure the AgoraStartRequest and send it to Agora's Conversational AI Engine. Agora's Convo AI engine will add the agent to the conversation.

## Agent Routes

With our types defined, let's implement the agent routes for inviting and removing agents from conversations.

Create the `agent` route:

```bash
touch src/routes/agent.ts
```

Start with importing express, our new types and the `agora-token library, because we'll need to generate tokens for the agent. Then we'll define the `agentRoutes` function.

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

/**
 * Registers agent-related routes for Agora Conversational AI
 */
export async function agentRoutes(fastify: FastifyInstance) {
  // TODO: Add the routes here
}
```

## Invite Agent Route

First we'll implement the `/agent/invite` endpoint. This route needs to handle several key tasks:

- Parse the user request and use it to create Start request for Agora's Convo AI Engine.
- Generate a token for the AI agent to access the RTC channel.
- Configure Text-to-Speech (Microsoft or ElevenLabs)
- Define the AI agent's prompt and greeting message.
- Configure the Voice Activity Detection (VAD), which controls conversation flow
- Sends the start request to Agora's Conversational AI Engine.
- Returns the response to the client that contains the AgentID from Agora's Convo AI Engine response.

Add the following code to the `agentRoutes` function:

```typescript
/**
 * POST /agent/invite
 * Invites an AI agent to join a specified channel
 */
fastify.post<{
  Body: InviteAgentRequest;
}>('/invite', async (request, reply) => {
  try {
    // Extract request parameters
    const {
      requester_id,
      channel_name,
      input_modalities = ['text'],
      output_modalities = ['text', 'audio'],
    } = request.body;

    // Validate environment variables
    if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
      return reply
        .code(500)
        .send({ error: 'Agora credentials not configured' });
    }

    if (
      !process.env.AGORA_CONVO_AI_BASE_URL ||
      !process.env.AGORA_CUSTOMER_ID ||
      !process.env.AGORA_CUSTOMER_SECRET
    ) {
      return reply.code(500).send({
        error: 'Agora Conversational AI credentials not configured',
      });
    }

    // Configure agent and generate token
    const agentUid = process.env.AGENT_UID || 'Agent';
    const timestamp = Date.now();
    const expirationTime = Math.floor(timestamp / 1000) + 3600; // 1 hour

    // Generate a token for the agent to join the channel
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      channel_name,
      agentUid,
      RtcRole.PUBLISHER,
      expirationTime,
      expirationTime
    );

    // Configure TTS settings based on environment variables
    const ttsVendor =
      (process.env.TTS_VENDOR as TTSVendor) || TTSVendor.Microsoft;
    const ttsConfig = getTTSConfig(ttsVendor);

    // Convert requester_id to string (Agora API expects string values)
    const requesterUid = requester_id.toString();

    // Create a descriptive name for this conversation instance
    const random = Math.random().toString(36).substring(2, 8);
    const uniqueName = `conversation-${timestamp}-${random}`;

    // Prepare request for Agora's Conversational AI API
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
              content:
                'You are a helpful assistant. Speak naturally and concisely.',
            },
          ],
          greeting_message: 'Hello! How can I assist you today?',
          failure_message: 'Please wait a moment.',
          max_history: 10,
          params: {
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
          input_modalities: input_modalities,
          output_modalities: output_modalities,
        },
        tts: ttsConfig,
        vad: {
          silence_duration_ms: 480,
          speech_duration_ms: 15000,
          threshold: 0.5,
          interrupt_duration_ms: 160,
          prefix_padding_ms: 300,
        },
        // These advanced features require special account permissions
        advanced_features: {
          enable_aivad: false,
          enable_bhvs: false,
        },
      },
    };

    // Send request to Agora Conversational AI API
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

    // Handle API response
    if (!response.ok) {
      const errorText = await response.text();
      fastify.log.error(
        {
          status: response.status,
          body: errorText,
        },
        'Agora API error'
      );

      return reply.code(response.status).send({
        error: `Failed to start conversation: ${response.status}`,
        details: errorText,
      });
    }

    // Return successful response with agent details
    const data: AgentResponse = await response.json();
    return reply.send(data);
  } catch (error) {
    fastify.log.error('Error starting conversation:', error);
    return reply.code(500).send({
      error:
        error instanceof Error ? error.message : 'Failed to start conversation',
    });
  }
});
```

### Remove Agent

After the agent joins the conversation, we need a way to remove them from the conversation. This is where the `/agent/remove` route comes in, it takes the agentID and sends a request to the Agora's Conversational AI Engine to remove the agent from the channel.

Add the following code to the `agentRoutes` function, just below the `/invite` route:

```typescript
  /**
   * POST /agent/remove
   * Removes an AI agent from a conversation
   */
  fastify.post<{
    Body: RemoveAgentRequest;
  }>('/remove', async (request, reply) => {
    try {
      const { agent_id } = request.body;

      if (!agent_id) {
        return reply.code(400).send({ error: 'agent_id is required' });
      }

      // Validate Agora credentials
      if (
        !process.env.AGORA_CONVO_AI_BASE_URL ||
        !process.env.AGORA_APP_ID ||
        !process.env.AGORA_CUSTOMER_ID ||
        !process.env.AGORA_CUSTOMER_SECRET
      ) {
        return reply
          .code(500)
          .send({ error: 'Agora credentials not configured' });
      }

      // Create authentication for API request
      const authCredential = Buffer.from(
        `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`
      ).toString('base64');

      // Send request to Agora API to remove the agent
      const response = await fetch(
        `${process.env.AGORA_CONVO_AI_BASE_URL}/${process.env.AGORA_APP_ID}/agents/${agent_id}/leave`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authCredential}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        fastify.log.error(
          {
            status: response.status,
            body: errorText,
          },
          'Agora API error on agent removal'
        );

        return reply.code(response.status).send({
          error: `Failed to remove agent: ${response.status}`,
          details: errorText,
        });
      }

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Error removing agent:', error);
      return reply.code(500).send({
        error:
          error instanceof Error ? error.message : 'Failed to remove agent',
      });
    }
  });
}
```

### Helper Function

In the start route we use a variable `ttsConfig` that calls `getTTSConfig`. I need to call out, because normally you would have a single TTS config. For demo purposes I've built it this way to show how to implement the configs for all TTS vendors supported by Agora's Convo AI Engine.

```typescript
/**
 * Helper function to generate TTS configuration based on vendor
 */
function getTTSConfig(vendor: TTSVendor): TTSConfig {
  if (vendor === TTSVendor.Microsoft) {
    // Validate Microsoft TTS configuration
    if (
      !process.env.MICROSOFT_TTS_KEY ||
      !process.env.MICROSOFT_TTS_REGION ||
      !process.env.MICROSOFT_TTS_VOICE_NAME
    ) {
      throw new Error('Microsoft TTS configuration missing');
    }

    return {
      vendor: TTSVendor.Microsoft,
      params: {
        key: process.env.MICROSOFT_TTS_KEY,
        region: process.env.MICROSOFT_TTS_REGION,
        voice_name: process.env.MICROSOFT_TTS_VOICE_NAME,
        rate: parseFloat(process.env.MICROSOFT_TTS_RATE || '1.0'),
        volume: parseFloat(process.env.MICROSOFT_TTS_VOLUME || '100.0'),
      },
    };
  }

  if (vendor === TTSVendor.ElevenLabs) {
    // Validate ElevenLabs TTS configuration
    if (
      !process.env.ELEVENLABS_API_KEY ||
      !process.env.ELEVENLABS_VOICE_ID ||
      !process.env.ELEVENLABS_MODEL_ID
    ) {
      throw new Error('ElevenLabs TTS configuration missing');
    }

    return {
      vendor: TTSVendor.ElevenLabs,
      params: {
        key: process.env.ELEVENLABS_API_KEY,
        voice_id: process.env.ELEVENLABS_VOICE_ID,
        model_id: process.env.ELEVENLABS_MODEL_ID,
      },
    };
  }

  throw new Error(`Unsupported TTS vendor: ${vendor}`);
}
```

The `agentRoutes` function defines two key endpoints:

1. **POST /agent/invite**: Creates and adds an AI agent to a specified channel by:

   - Generating a secure token for the agent
   - Configuring TTS (Text-to-Speech) settings
   - Setting the AI's behavior via system messages
   - Sending a request to Agora's Conversational AI API

2. **POST /agent/remove**: Removes an AI agent from a conversation by:
   - Taking the agent_id from the request
   - Sending a leave request to Agora's API

> **Note:** The Agent routes load a number of environment variables. Make sure to set these in your `.env` file. At the end of this guide, I've included a list of all the environment variables you'll need to set.

### Add Agent Routes to the Main Server

Let's update our main `index.ts` file to register the agent routes. Open the `src/index.ts` and add:

```typescript
// Previous imports remain the same
import { agentRoutes } from './routes/agent';

// Previous code remains the same..

// Register routes
fastify.register(agentRoutes, { prefix: '/agent' }); // register the agent routes

// Rest of the code remains the same...
```

Now we have the core Conversational AI functionality working! Let's implement the token generation route, which will make it easier to test and integrate with frontend applications.

## Token Generation

The goal with this guide is meant to build a stand-alone micro-service that works with existing Agora client apps, so for completeness we'll implement a token generation route.

Create a new file at `src/routes/token.ts`:

```bash
touch src/routes/token.ts
```

Expalining this code is a bit outside the scope of this guide, but if you are new to tokens i would recommend checking out my guide [Building a Token Server for Agora Applications](https://www.agora.io/en/blog/how-to-build-a-token-server-for-agora-applications-using-nodejs/).

One unique element of the token route that's worth highlighting is that if a uid or channel name are not provided, this code use 0 for the uid and generates a unique channel name. The channel name and UID are returned with every token.

Add the following code to the `src/routes/token.ts` file:

```typescript
import { FastifyInstance } from 'fastify';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Interface for token request parameters
interface TokenQuerystring {
  uid?: string;
  channel?: string;
}

/**
 * Registers routes for Agora token generation
 */
export async function tokenRoutes(fastify: FastifyInstance) {
  // Define validation schema for query parameters
  const schema = {
    querystring: {
      type: 'object',
      properties: {
        uid: { type: 'string', description: 'User ID (optional)' },
        channel: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-]{1,64}$',
          description:
            'Channel name (optional, will be generated if not provided)',
        },
      },
    },
  };

  /**
   * GET /token - Generate an Agora token for RTC communication
   */
  fastify.get<{
    Querystring: TokenQuerystring;
  }>('/', {
    schema,
    handler: async (request, reply) => {
      fastify.log.info('Generating Agora token...');

      // Validate Agora credentials
      if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
        return reply
          .code(500)
          .send({ error: 'Agora credentials not configured' });
      }

      // Get parameters from query or use defaults
      const { uid: uidStr, channel } = request.query;
      const uid = parseInt(uidStr || '0');
      const channelName = channel || generateChannelName();

      // Set token expiration (1 hour from now)
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      try {
        fastify.log.info(
          `Building token with UID: ${uid}, Channel: ${channelName}`
        );

        // Generate the Agora token
        const token = RtcTokenBuilder.buildTokenWithUid(
          process.env.AGORA_APP_ID,
          process.env.AGORA_APP_CERTIFICATE,
          channelName,
          uid,
          RtcRole.PUBLISHER, // Allow publishing audio/video
          expirationTime,
          expirationTime
        );

        fastify.log.info('Token generated successfully');

        // Return token data to client
        return {
          token,
          uid: uid.toString(),
          channel: channelName,
        };
      } catch (error) {
        fastify.log.error('Error generating Agora token:', error);
        return reply.code(500).send({
          error: 'Failed to generate Agora token',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Generates a unique channel name
 * Format: ai-conversation-{timestamp}-{random}
 */
function generateChannelName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ai-conversation-${timestamp}-${random}`;
}
```

Now, update the main `index.ts` file to register the token routes. Update `src/index.ts`:

```typescript
// Previous imports remain the same
import { tokenRoutes } from './routes/token';

// Previous code remains the same...

// Register routes
// - previous agent routes remain the same
fastify.register(tokenRoutes, { prefix: '/token' }); // register the token routes

// Rest of the code remains the same...
```

With the token generation in place, let's add some validation middleware to ensure our API is robust and secure.

## Validating env and requests

Proper validation ensures our API receives correctly formatted requests and helps prevent errors.

Create a file at `src/middlewares/validation.ts`:

```bash
touch src/middlewares/validation.ts
```

This will validate the env vars are setup right and all incoming requests to make sure they match the client request types that we defined.

Add the following code to the `src/middlewares/validation.ts` file:

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  InviteAgentRequest,
  RemoveAgentRequest,
} from '../types/client-request-types';

/**
 * Validates that required environment variables are configured
 * based on the route being accessed
 */
export async function validateEnvironment(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // All routes need Agora credentials
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    request.log.error('Agora credentials are not set');
    return reply.code(500).send({ error: 'Agora credentials are not set' });
  }

  // Agent routes need additional validation
  if (request.url.startsWith('/agent')) {
    // Conversational AI credentials
    if (
      !process.env.AGORA_CONVO_AI_BASE_URL ||
      !process.env.AGORA_CUSTOMER_ID ||
      !process.env.AGORA_CUSTOMER_SECRET
    ) {
      request.log.error('Agora Conversation AI credentials are not set');
      return reply.code(500).send({
        error: 'Agora Conversation AI credentials are not set',
      });
    }

    // LLM configuration
    if (!process.env.LLM_URL || !process.env.LLM_TOKEN) {
      request.log.error('LLM configuration is not set');
      return reply.code(500).send({ error: 'LLM configuration is not set' });
    }

    // TTS configuration
    const ttsVendor = process.env.TTS_VENDOR;
    if (!ttsVendor) {
      request.log.error('TTS_VENDOR is not set');
      return reply.code(500).send({ error: 'TTS_VENDOR is not set' });
    }

    // Vendor-specific TTS validation
    if (ttsVendor === 'microsoft') {
      if (
        !process.env.MICROSOFT_TTS_KEY ||
        !process.env.MICROSOFT_TTS_REGION ||
        !process.env.MICROSOFT_TTS_VOICE_NAME
      ) {
        request.log.error('Microsoft TTS configuration is incomplete');
        return reply.code(500).send({
          error: 'Microsoft TTS configuration is incomplete',
        });
      }
    } else if (ttsVendor === 'elevenlabs') {
      if (
        !process.env.ELEVENLABS_API_KEY ||
        !process.env.ELEVENLABS_VOICE_ID ||
        !process.env.ELEVENLABS_MODEL_ID
      ) {
        request.log.error('ElevenLabs TTS configuration is incomplete');
        return reply.code(500).send({
          error: 'ElevenLabs TTS configuration is incomplete',
        });
      }
    } else {
      return reply.code(500).send({
        error: `Unsupported TTS vendor: ${ttsVendor}`,
      });
    }
  }
}

/**
 * Check that POST requests use the correct Content-Type header
 */
export async function validateContentType(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (
    request.method === 'POST' &&
    request.headers['content-type'] !== 'application/json'
  ) {
    return reply.code(415).send({
      error: 'Unsupported Media Type. Content-Type must be application/json',
    });
  }
}

/**
 * Validates request bodies for specific routes
 */
export async function validateRequestBody(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip validation for non-POST requests
  if (request.method !== 'POST') {
    return;
  }

  // Ensure request has a body
  const body = request.body as any;
  if (!body || Object.keys(body).length === 0) {
    return reply.code(400).send({ error: 'Request body is required' });
  }

  // Route-specific validation
  if (request.url === '/agent/invite') {
    const { requester_id, channel_name } = body as InviteAgentRequest;

    // Required fields check
    if (!requester_id) {
      return reply.code(400).send({ error: 'requester_id is required' });
    }

    if (!channel_name) {
      return reply.code(400).send({ error: 'channel_name is required' });
    }

    // Validate requester_id format
    if (typeof requester_id === 'string') {
      if (requester_id.trim() === '') {
        return reply.code(400).send({
          error: 'requester_id cannot be empty',
        });
      }
    } else if (typeof requester_id === 'number') {
      if (!Number.isInteger(requester_id) || requester_id < 0) {
        return reply.code(400).send({
          error:
            'requester_id must be a positive integer when provided as a number',
        });
      }
    } else {
      return reply.code(400).send({
        error: 'requester_id must be a string or number',
      });
    }

    // Validate channel_name format
    if (typeof channel_name !== 'string') {
      return reply.code(400).send({
        error: 'channel_name must be a string',
      });
    }

    if (channel_name.length < 3 || channel_name.length > 64) {
      return reply.code(400).send({
        error: 'channel_name length must be between 3 and 64 characters',
      });
    }
  } else if (request.url === '/agent/remove') {
    const { agent_id } = body as RemoveAgentRequest;

    if (!agent_id) {
      return reply.code(400).send({ error: 'agent_id is required' });
    }

    if (typeof agent_id !== 'string') {
      return reply.code(400).send({ error: 'agent_id must be a string' });
    }
  }
}
```

Now, update the main `index.ts` file to register the validation middlewares. Update `src/index.ts`:

```typescript
// Previous imports remain the same
import {
  validateEnvironment,
  validateContentType,
  validateRequestBody,
} from './middlewares/validation';

// Previous code remains the same
// - Load environment variables
// - Create Fastify instance
// - Register CORS

// Register global middlewares
fastify.addHook('onRequest', validateContentType);
fastify.addHook('preValidation', validateEnvironment);
fastify.addHook('preValidation', validateRequestBody);

// Register routes remain the same

// Rest of the code remains the same...
```

## Setting Up Development Workflow

Now that we have the core functionality in place, let's set up a proper development workflow. We'll configure nodemon to automatically restart the server when files change.

Create a `nodemon.json` file in the project root:

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

## Testing the Server

Before we can test our endpoints, make sure you have a client-side app running. You can use any applicaiton that implements Agora's video SDK (web, mobile, or desktop). If you don't have an app you can use [Agora's Voice Demo](https://webdemo.agora.io/basicVoiceCall/index.html), just make sure to make a token request before joining the channel.

Let's test our server to make sure everything is working correctly. First, ensure your `.env` file is properly configured with all the necessary credentials.

Start the server in development mode:

```bash
npm run dev
```

> **Note:** Make sure your `.env` file is properly configured with all the necessary credentials. There is a complete list of environment variables at the end of this guide.

If your server is running correctly, you should see output like:

```
Server is running on port 3030
```

## Testing the Server

Before we can test our endpoints, make sure you have a client-side app running. You can use any applicaiton that implements Agora's video SDK (web, mobile, or desktop). If you don't have an app you can use [Agora's Voice Demo](https://webdemo.agora.io/basicVoiceCall/index.html), just make sure to make a token request before joining the channel.

Let's test our API endpoints using curl:

### 1. Generate a Token

```bash
curl http://localhost:3030/token
```

Expected response (your values will be different):

```json
{
  "token": "007eJxTYBAxNdgrlvnEfm3o...",
  "uid": "0",
  "channel": "ai-conversation-1665481623456-abc123"
}
```

### 2. Generate Token with Specific Parameters

```bash
curl "http://localhost:3000/token?channel=test-channel&uid=1234"
```

### 3. Invite an Agent

```bash
curl -X POST http://localhost:3030/agent/invite \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "1234",
    "channel_name": "YOUR_CHANNEL_NAME_FROM_PREVIOUS_STEP",
    "input_modalities": ["text"],
    "output_modalities": ["text", "audio"]
  }'
```

Expected response (your values will be different):

```json
{
  "agent_id": "agent-abc123",
  "create_ts": 1665481725000,
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

## Error Handling

The server implements consistent error handling across all routes:

```typescript
try {
  // Route logic
} catch (error) {
  fastify.log.error('Error description:', error);
  reply.code(500).send({
    error: error instanceof Error ? error.message : 'Error description',
  });
}
```

Common error responses:

- 400: Bad Request (invalid parameters)
- 415: Unsupported Media Type (wrong Content-Type)
- 500: Server Error (missing configuration or runtime errors)

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
MICROSOFT_TTS_VOICE_NAME=en-US-AndrewMultilingualNeural
MICROSOFT_TTS_RATE=1.0  # Range: 0.5 to 2.0
MICROSOFT_TTS_VOLUME=100.0  # Range: 0.0 to 100.0

# ElevenLabs TTS Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

## Next Steps

Congratulations! You've built an Express server that integrates with Agora's Conversational AI Engine. Take this microservice and integrateit with your existing Agora backends.

For more information about [Agora's Convesational AI Engine](https://www.agora.io/en/products/conversational-ai-engine/) check out the [official documenation](https://docs.agora.io/en/).

Happy building!
