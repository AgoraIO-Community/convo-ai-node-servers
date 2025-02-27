# Agora ConvoAI Node Server Examples

This repo contains implementations of Agora's Conversational AI RESTful API using Node.js. There are two implementations provided:

- Express.js
- Fastify

## What is Agora ConvoAI?

Agora's Conversational AI Engine allows you to integrate real-time voice conversations with AI agents into your applications. Users can have natural, voice-based interactions with AI instead of typing text prompts.

## Key Features

- Choose your own LLM provider endpoint (OpenAI, Anthropic, Llama, Custom, etc.)
- Configure your Text-to-Speech provider (Microsoft Azure or ElevenLabs)
- Invite/remove agents within voice channels

## Build your own server

To learn how to build your own server from scratch, follow the detailed step-by-step guides:

- [Express.js Implementation Guide](docs/EXPRESS_GUIDE.md)
- [Fastify Implementation Guide](docs/FASTIFY_GUIDE.md)

## Run the existing servers

1. Choose your preferred server implementation:

   - For Express.js implementation, navigate to the [`/express`](/express) directory
   - For Fastify implementation, navigate to the [`/fastify`](/fastify) directory

2. Follow the setup instructions in the README.md file within your chosen implementation's directory.

## Prerequisites

- Node.js (v18 or higher)
- An [Agora account](https://console.agora.io/) with Conversational AI service activated
- API keys for TTS services (Microsoft Azure or ElevenLabs)

## Documentation

- [Agora Conversational AI Documentation](https://docs.agora.io/en/)
- [Express.js Documentation](https://expressjs.com/)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
