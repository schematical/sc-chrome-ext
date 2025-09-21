import { ChatOpenAI } from "@langchain/openai";
import {BaseChatModel} from "@langchain/core/language_models/chat_models";


export async function createChatModel(): Promise<BaseChatModel | ChatOpenAI> {
  switch (process.env.LLM_PROVIDER) {
    case 'openai':
      return new ChatOpenAI({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
      })
      break;
    default:
      throw new Error(`Unsupported provider "${process.env.LLM_PROVIDER}"`);
  }
}
