import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  AISDKError,
  type CoreMessage,
  type CoreTool,
  type CoreToolMessage,
  type LanguageModelV1,
  ToolCallPart,
  type ToolResultPart,
  jsonSchema,
  streamText,
} from "ai";
import type { BaseClient } from "./mcpTools/baseClient.js";
import { createFilesystemClient } from "./mcpTools/filesystemClient.js";
import { createClients } from "./mcpTools/mcpManager.js";
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
    // Create filesystem client (special handling as it uses InMemoryTransport)
    const filesystemClient = await createFilesystemClient(allowedDirectory);
    this.clients.push(filesystemClient);

    const stdioClients = await createClients();
    this.clients.push(...stdioClients);

    // Consolidate tools from all clients into a flattened array for passing to the model
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

  private async processToolCalls(toolCalls: ToolCallPart[]): Promise<CoreToolMessage> {
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

    return {
      role: "tool",
      content: toolResults,
    };
  }

  private createInitialToolCallMessage(filePaths: string[]): CoreMessage {
    const toolName = filePaths?.length ? "read_files" : "tree";
    const toolCallId = `0_${toolName}`;
    let args: any = {};

    if (toolName === "tree") {
      args = {
        path: ".",
        maxDepth: 3,
      };
    } else if (toolName === "read_files" && filePaths) {
      args = {
        paths: filePaths,
      };
    }

    return {
      role: "assistant" as const,
      content: [
        {
          type: "tool-call" as const,
          toolCallId,
          toolName,
          args,
        },
      ],
    };
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
    if (systemPrompt && currentMessages.length === 0) {
      currentMessages.push({ role: "system" as const, content: systemPrompt });
    }
    const userMessage = { role: "user" as const, content: userPrompt };
    currentMessages.push(userMessage);
    onMessage(userMessage);

    // If this is the first message of chat, add a forced initial tool call.
    // Check length 2 for system + user message
    if (currentMessages.length <= 2) {
      const initialToolCall = this.createInitialToolCallMessage(userFiles);
      currentMessages.push(initialToolCall);
      onMessage(initialToolCall);
    }

    // Main conversation loop
    while (true) {
      // Process any pending tool calls from the last message
      const lastMessage = currentMessages[currentMessages.length - 1];
      if (lastMessage.role === "assistant") {
        const toolCalls = Array.isArray(lastMessage.content)
          ? lastMessage.content.filter((content) => content.type === "tool-call")
          : [];

        // Break if the last message is from the assistant and doesn't contain tool calls
        if (toolCalls.length === 0) {
          break;
        }

        // Process all tool calls and LLM responses
        const toolResulMessage = await this.processToolCalls(toolCalls);
        log.debug("toolResulMessage :>>", toolResulMessage);
        currentMessages.push(toolResulMessage);
        onMessage(toolResulMessage);
      }

      // Get LLM response
      log.debug("calling model");
      const result = streamText({
        model: this.model,
        maxTokens: 8000,
        maxSteps: 20,
        messages: currentMessages,
        tools: this.toolsForModel,
        onError: async ({ error }) => {
          // We need to listen for and throw the error, else the textStream will just close silently and the result won't finish
          throw error;
        },
      });

      onTextStream(result.textStream);
      // Consume the stream to ensure it runs to completion and throws any errors
      try {
        await result.consumeStream();
      } catch (error) {
        log.debug("streamText consumeStream error:", error);
        if (AISDKError.isInstance(error)) {
          throw new Error(error.message);
        } else {
          throw error;
        }
        throw new Error();
      }

      const assistantMessages = (await result.response).messages;
      log.debug("assistantMessages :>>", assistantMessages);

      // Add assistant messages to conversation
      currentMessages.push(...assistantMessages);
      assistantMessages.forEach(onMessage);

      // Break if there are no tool calls
      const llmToolCalls = await result.toolCalls;
      if (!llmToolCalls.length) {
        break;
      }
    }

    log.debug("all messages :>>", currentMessages);
  }

  async cleanup(): Promise<void> {
    for (const client of this.clients) {
      await client.close();
    }
  }
}
