import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  jsonSchema,
  streamText,
  ToolCallPart,
  type CoreMessage,
  type CoreTool,
  type CoreToolMessage,
  type LanguageModelV1,
  type ToolResultPart,
} from "ai";
import type { BaseClient } from "./mcpTools/baseClient.js";
import { createFilesystemClient } from "./mcpTools/filesystemClient.js";
import { log } from "./utils/logger.js";

export async function createHost({ allowedDirectory }: { allowedDirectory: string }) {
  const host = new Host();
  await host.createClientsServers(allowedDirectory);
  return host;
}

export class Host {
  model?: LanguageModelV1;
  clients: BaseClient[] = [];
  toolsForModel: Record<string, CoreTool> = {};
  toolsToClientMap: Record<string, BaseClient> = {};

  setModel({
    model,
    apiKey,
    modelProvider,
  }: { model: string; apiKey: string; modelProvider: "Anthropic" | "Deepseek" | "Gemini" | "OpenAI" }) {
    switch (modelProvider) {
      case "Anthropic":
        const anthropic = createAnthropic({ apiKey });
        this.model = anthropic(model);
        break;

      case "Deepseek":
        const deepseek = createDeepSeek({ apiKey });
        this.model = deepseek(model);
        break;

      case "Gemini":
        const google = createGoogleGenerativeAI({ apiKey });
        this.model = google(model);
        break;

      case "OpenAI":
        const openai = createOpenAI({ apiKey });
        this.model = openai(model);
        break;

      default:
        throw new Error(`Unsupported model provider: ${modelProvider}`);
    }
  }

  async createClientsServers(allowedDirectory: string): Promise<void> {
    const client = await createFilesystemClient(allowedDirectory);
    this.clients.push(client);

    for (const client of this.clients) {
      const toolsResponse = await client.listTools();
      for (const tool of toolsResponse.tools) {
        this.toolsForModel[tool.name] = {
          description: tool.description,
          parameters: jsonSchema(tool.inputSchema),
        };
        this.toolsToClientMap[tool.name] = client;
      }
    }
  }

  async processQuery({
    systemPrompt,
    userPrompt,
    previousMessages = [],
    onMessage,
    onTextStream,
    userFiles,
  }: {
    systemPrompt?: string;
    userPrompt: string;
    previousMessages?: CoreMessage[];
    onMessage: (message: CoreMessage) => void;
    onTextStream: (stream: AsyncIterable<string>) => void;
    userFiles: string[];
  }) {
    if (!this.model) {
      throw new Error("Language model not initialized");
    }
    if (this.clients.length === 0) {
      throw new Error("No clients connected.");
    }
    log.debug("userPrompt :>>", userPrompt);
    log.debug("systemPrompt :>>", systemPrompt);

    let currentMessages = [...previousMessages];
    if (systemPrompt && currentMessages.length === 0)
      currentMessages.push({ role: "system" as const, content: systemPrompt });
    const userMessage = { role: "user" as const, content: userPrompt };
    currentMessages.push(userMessage);
    onMessage(userMessage);

    // Process all tool calls and LLM responses
    const processToolCalls = async (toolCalls: ToolCallPart[], addToMessages: boolean = true) => {
      if (!toolCalls.length) return null;

      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const { toolName, args, toolCallId } = toolCall;
          const client = this.toolsToClientMap[toolName];

          if (!client) {
            throw new Error(`Tool ${toolName} not found`);
          }

          log.debug(`[Calling tool ${toolName} with args ${JSON.stringify(args)}]`);
          const toolResult = await client.callTool(toolName, args);

          return {
            type: "tool-result",
            toolCallId,
            toolName,
            result: toolResult.content[0].text,
          } as ToolResultPart;
        }),
      );

      const toolMessage: CoreToolMessage = {
        role: "tool",
        content: toolResults,
      };

      log.debug("toolMessage :>>", toolMessage);
      if (addToMessages) {
        currentMessages.push(toolMessage);
        onMessage(toolMessage);
      }

      return toolMessage;
    };

    // only force tool call for the first message in chat
    // length === 2 (system + user)
    if (currentMessages.length === 2) {
      if (userFiles.length > 0) {
        const userFilesToolCall = {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "0_read_files",
              toolName: "read_files",
              args: {
                paths: userFiles,
              },
            },
          ],
        };
        currentMessages.push(userFilesToolCall);
        onMessage(userFilesToolCall);
      } else {
        const initialTreeToolCall = {
          role: "assistant" as const,
          content: [
            {
              type: "tool-call" as const,
              toolCallId: "0_tree",
              toolName: "tree",
              args: {
                path: ".",
                maxDepth: 3,
              },
            },
          ],
        };
        currentMessages.push(initialTreeToolCall);
        onMessage(initialTreeToolCall);
      }
    }

    // Main conversation loop
    while (true) {
      // Process any pending tool calls from the last message
      const lastMessage = currentMessages[currentMessages.length - 1];
      if (lastMessage.role === "assistant" && Array.isArray(lastMessage.content)) {
        const toolCalls = lastMessage.content.filter((content) => content.type === "tool-call");

        await processToolCalls(toolCalls);
      }
      // Break if the last message is from the assistant and doesn't contain tool calls
      if (lastMessage.role === "assistant" && !Array.isArray(lastMessage.content)) {
        break;
      }

      // Get LLM response
      log.debug("calling model");
      const result = streamText({
        model: this.model,
        maxTokens: 8000,
        maxSteps: 20,
        messages: currentMessages,
        tools: this.toolsForModel,
      });

      onTextStream(result.textStream);
      const assistantMessages = (await result.response).messages;
      log.debug("assistantMessages :>>", assistantMessages);

      // Add assistant messages to conversation
      currentMessages.push(...assistantMessages);
      assistantMessages.forEach(onMessage);

      // Process any tool calls from the LLM
      const llmToolCalls = await result.toolCalls;
      if (!llmToolCalls?.length) {
        break;
      }
      await processToolCalls(llmToolCalls);
    }

    log.debug("all messages :>>", currentMessages);
  }

  async cleanup(): Promise<void> {
    for (const client of this.clients) {
      await client.close();
    }
  }
}
