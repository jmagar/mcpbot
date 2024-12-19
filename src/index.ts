import 'dotenv/config';
import { genkit } from 'genkit';
import { mcpClient } from 'genkitx-mcp';
import { googleAI, gemini15Pro } from '@genkit-ai/googleai';
import { anthropic } from 'genkitx-anthropic';
import { createInterface } from 'node:readline/promises';
import path from 'path';

// Get the absolute path to the workspace
const WORKSPACE_DIR = process.cwd();

// Initialize Genkit with all our plugins
const ai = genkit({
  plugins: [
    // MCP plugin for filesystem access
    mcpClient({
      name: 'filesystem',
      serverProcess: {
        command: 'npx',
        args: [
          '@modelcontextprotocol/server-filesystem',
          WORKSPACE_DIR,
        ],
      },
    }),
    // Google AI plugin for Gemini models
    googleAI(),
    // Anthropic plugin for Claude models
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  ],
});

// Available models
const MODELS = {
  gemini: gemini15Pro,
  claude: 'anthropic/claude-3-opus-20240229',
} as const;

type ModelKey = keyof typeof MODELS;

// Function to get the current model name
function getCurrentModel(modelKey: ModelKey) {
  return `Using ${modelKey} model`;
}

async function startChat() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Let user choose the model
  console.log('Available models:');
  Object.keys(MODELS).forEach((model) => console.log(`- ${model}`));

  let modelChoice = (await readline.question('Choose a model: ')).toLowerCase() as ModelKey;

  if (!MODELS[modelChoice]) {
    console.log('Invalid model choice. Defaulting to Gemini.');
    modelChoice = 'gemini';
  }

  // Create a chat session with the chosen model
  let chat = ai.chat({
    model: MODELS[modelChoice],
    system: `You are a helpful AI assistant with access to filesystem operations through MCP. 
    You can help users with file operations and answer questions.
    Always be clear about what files you're accessing or operations you're performing.
    You have access to files in: ${WORKSPACE_DIR}`,
  });

  console.log('\n' + getCurrentModel(modelChoice));
  console.log('Chat started! Type "exit" to end the conversation or "switch" to change models.\n');

  let isRunning = true;
  while (isRunning) {
    const input = await readline.question('You: ');

    if (input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      isRunning = false;
      continue;
    }

    if (input.toLowerCase() === 'switch') {
      const newModel = (await readline.question('Choose new model: ')).toLowerCase() as ModelKey;
      if (MODELS[newModel]) {
        chat = ai.chat({
          model: MODELS[newModel],
          system: `You are a helpful AI assistant with access to filesystem operations through MCP. 
          You can help users with file operations and answer questions.
          Always be clear about what files you're accessing or operations you're performing.
          You have access to files in: ${WORKSPACE_DIR}`,
        });
        console.log('\n' + getCurrentModel(newModel));
        continue;
      } else {
        console.log('Invalid model choice. Keeping current model.');
        continue;
      }
    }

    try {
      const response = await chat.send(input);
      console.log('\nAssistant:', response.text, '\n');
    } catch (error) {
      console.error('Error:', error);
    }
  }

  readline.close();
}

// Start the chat
console.log('Starting MCP Chatbot...\n');
startChat().catch(console.error);
