import { ai, MODELS, ModelKey, getCurrentModel } from '../core/ai.js';
import { WORKSPACE_DIR } from '../core/config.js';

// Chat session class to manage individual chat sessions
export class ChatSession {
  private chat;
  private currentModel: ModelKey;

  constructor(modelKey: ModelKey = 'gemini') {
    this.currentModel = modelKey;
    this.chat = this.createChat(modelKey);
  }

  private createChat(modelKey: ModelKey) {
    return ai.chat({
      model: MODELS[modelKey],
      system: `You are a helpful AI assistant with access to both filesystem operations and web search capabilities through MCP.
      
      For filesystem operations:
      - You can help users with file operations and answer questions
      - Always be clear about what files you're accessing or operations you're performing
      - You have access to files in: ${WORKSPACE_DIR}
      
      For web search:
      - You can search the web using Brave Search to find current information
      - Use search when you need to answer questions about current events or verify facts
      - Always cite your sources when providing information from web searches`,
    });
  }

  public switchModel(modelKey: ModelKey): boolean {
    if (MODELS[modelKey]) {
      this.currentModel = modelKey;
      this.chat = this.createChat(modelKey);
      return true;
    }
    return false;
  }

  public getCurrentModelName(): string {
    return getCurrentModel(this.currentModel);
  }

  public async sendMessage(message: string): Promise<string> {
    try {
      const response = await this.chat.send(message);
      return response.text;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }
}
