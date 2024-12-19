# MCP Bot

A chatbot using Genkit with MCP (Model Context Protocol) plugin, supporting multiple AI models including Gemini and Claude.

## Features

- Multiple model support (Gemini, Claude)
- Filesystem operations through MCP
- Interactive chat interface
- Model switching during conversation
- Environment-based configuration

## Prerequisites

- Node.js >= 20.0.0
- npm
- API keys for:
  - Google AI (Gemini)
  - Anthropic (Claude)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/jmagar/mcpbot.git
cd mcpbot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys:
```env
GOOGLE_GENAI_API_KEY=your_google_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Usage

### Start the bot
```bash
npm start
```

### Development mode (with auto-reload)
```bash
npm run dev
```

### Debug mode
```bash
npm run debug
```

## Available Commands

- `npm start` - Start the chatbot
- `npm run dev` - Run in development mode with auto-reload
- `npm run debug` - Run in debug mode with inspector
- `npm run build` - Build the TypeScript code
- `npm run clean` - Clean the build directory
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint and fix issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Chat Commands

- Type `exit` to end the conversation
- Type `switch` to change between models
- Any other input will be sent to the current model

## License

ISC
