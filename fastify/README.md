# Agora Fastify Server

This Fastify server implements endpoints for managing conversational AI agents using Agora's ConvoAI REST API.

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your configuration values

   ```bash
   cp .env.example .env
   ```

3. Start the server

   Development

   ```bash
   npm run dev
   ```

   Production

   ```bash
   npm start
   ```

## API Endpoints

### GET /token

Generate an Agora PUBLISHER token for uid 0, and generate a channel name.

```bash
curl -X GET "http://localhost:3030/token"
```

Generate token with specific channel and uid

```bash
curl -X GET "http://localhost:3030/token?channel=test-channel&uid=1234"
```

Response:

```json
{
  "token": "007eJxzYBB...",
  "uid": "1234",
  "channel": "test-channel"
}
```

### POST /agent/invite

Start a conversation with an AI agent.

```bash
curl -X POST "http://localhost:3030/agent/invite" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "1234",
    "channel_name": "test-channel",
    "input_modalities": ["text"],
    "output_modalities": ["text", "audio"]
  }'
```

Response:

```json
{
  "agent_id": "agent-123",
  "create_ts": 1234567890,
  "state": "active"
}
```

### POST /agent/remove

Remove an AI agent from the channel.

```bash
curl -X POST "http://localhost:3030/agent/remove" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-123"
  }'
```

Response:

```json
{
  "success": true
}
```

## Environment Variables

See `.env.example` for all required environment variables.

## Validation

The server implements request validation using Fastify's schema validation:

- Token requests validate uid (must be a number) and channel name (1-64 alphanumeric characters with hyphens)
- Agent invite requests validate requester_id and channel_name format
- All endpoints validate required environment variables
