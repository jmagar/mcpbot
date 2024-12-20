import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { ModelKey, MODELS } from './core/ai.js';
import { ChatSession } from './server/chat.js';

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
  const chatSession = new ChatSession(modelChoice);

  console.log('\n' + chatSession.getCurrentModelName());
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
        chatSession.switchModel(newModel);
        console.log('\n' + chatSession.getCurrentModelName());
        continue;
      } else {
        console.log('Invalid model choice. Keeping current model.');
        continue;
      }
    }

    try {
      const response = await chatSession.sendMessage(input);
      console.log('\nAssistant:', response, '\n');
    } catch (error) {
      console.error('Error:', error);
    }
  }

  readline.close();
}

// Start the chat
console.log('Starting MCP Chatbot...\n');
startChat().catch(console.error);
