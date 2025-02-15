# Agora ConvoAI Node Server Examples

This repo contains example implementations of Node.js-based microservices that demonstrate how to interact with Agora's Conversational AI RESTful API. The examples are provided in multiple server frameworks to suit different preferences and requirements.

## Available Implementations

### Express Server

The `/express` directory contains an implementation using the Express.js framework, known for its simplicity and extensive middleware ecosystem.

### Fastify Server

The `/fastify` directory contains an implementation using the Fastify framework, which focuses on providing maximum performance and low overhead.

## Getting Started

1. Choose your preferred server implementation:

   - For Express.js implementation, navigate to the [`/express`](/express) directory
   - For Fastify implementation, navigate to the [`/fastify`](/fastify) directory

2. Follow the setup instructions in the README.md file within your chosen implementation's directory.

Both implementations provide the same functionality and API endpoints, so you can choose the one that best fits your needs.

## Common Features

Both implementations include:

- Token generation for Agora RTC
- AI agent management (invite/remove)
- Environment configuration for various services
- Input/Output modality support
- Text-to-Speech integration (Microsoft Azure and ElevenLabs)

Choose your preferred implementation and refer to its specific README for detailed setup and usage instructions.
