import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText, streamText, CoreMessage, StreamTextResult, GenerateTextResult, LanguageModel } from 'ai';
import { Config, validateAIProvider } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';
import { tools } from '../tools/index.js';

const logger = createContextLogger('AIProvider');

export interface AIProviderOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIProvider {
  private model: LanguageModel;
  private providerName: string;
  private options: AIProviderOptions;

  constructor(options: AIProviderOptions = {}) {
    this.providerName = validateAIProvider();
    this.options = options;
    this.model = this.initializeModel(options);
    
    logger.info('AI Provider initialized', { 
      provider: this.providerName,
      model: options.model || 'default'
    });
  }

  private initializeModel(options: AIProviderOptions): LanguageModel {
    switch (this.providerName) {
      case 'openai':
        return openai(options.model || 'gpt-4o-mini');
      
      case 'anthropic':
        return anthropic(options.model || 'claude-3-5-sonnet-20241022');
      
      case 'google':
        return google(options.model || 'gemini-1.5-pro-latest');
      
      default:
        throw new Error(`Unsupported AI provider: ${this.providerName}`);
    }
  }

  async generateText(
    messages: CoreMessage[],
    systemPrompt?: string,
    enableTools: boolean = true
  ): Promise<GenerateTextResult<typeof tools, {}>> {
    try {
      const systemMessage: CoreMessage[] = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }]
        : [];

      const result = await generateText({
        model: this.model,
        messages: [...systemMessage, ...messages],
        tools: enableTools ? tools : undefined,
        maxSteps: 5,
        maxTokens: this.options.maxTokens || 4000,
        temperature: this.options.temperature || 0.1,
      });

      logger.info('Text generation completed', {
        provider: this.providerName,
        tokensUsed: result.usage?.totalTokens || 0,
        toolCallsCount: result.toolCalls?.length || 0,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Text generation failed', { 
        provider: this.providerName,
        error: errorMessage 
      });
      throw new Error(`AI text generation failed: ${errorMessage}`);
    }
  }

  async generateStream(
    messages: CoreMessage[],
    systemPrompt?: string,
    enableTools: boolean = true
  ): Promise<StreamTextResult<typeof tools, {}>> {
    try {
      const systemMessage: CoreMessage[] = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }]
        : [];

      const result = await streamText({
        model: this.model,
        messages: [...systemMessage, ...messages],
        tools: enableTools ? tools : undefined,
        maxSteps: 5,
        maxTokens: this.options.maxTokens || 4000,
        temperature: this.options.temperature || 0.1,
      });

      logger.info('Stream generation started', {
        provider: this.providerName,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Stream generation failed', { 
        provider: this.providerName,
        error: errorMessage 
      });
      throw new Error(`AI stream generation failed: ${errorMessage}`);
    }
  }

  getProviderInfo() {
    return {
      name: this.providerName,
      model: this.model,
    };
  }
}

// Export a default instance
export const defaultAIProvider = new AIProvider();
