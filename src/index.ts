import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { ai, MODELS, ModelKey, getCurrentModel } from './core/ai.js';
import { WORKSPACE_DIR } from './core/config.js';

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
