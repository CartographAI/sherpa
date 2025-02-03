import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  jsonSchema,
  streamText,
  type CoreMessage,
  type CoreTool,
  type CoreToolMessage,
  type LanguageModelV1,
  type ToolResultPart,
} from "ai";
import type { BaseClient } from "./mcpTools/baseClient";
import { createFilesystemClient } from "./mcpTools/filesystemClient";

export async function createHost({ allowedDirectories }: { allowedDirectories: string[] }) {
  const host = new Host();
  await host.createClientsServers(allowedDirectories);
  return host;
}

export class Host {
  model?: LanguageModelV1;
  clients: BaseClient[] = [];
  toolsForModel: Record<string, CoreTool> = {};
  toolsToClientMap: Record<string, BaseClient> = {};

  setModel({ model, apiKey, modelProvider }: { model: string; apiKey: string; modelProvider: "Anthropic" | "Gemini" }) {
    if (modelProvider === "Anthropic") {
      const anthropic = createAnthropic({ apiKey });
      this.model = anthropic(model);
    } else if (modelProvider === "Gemini") {
      const google = createGoogleGenerativeAI({ apiKey });
      this.model = google(model);
    }
  }

  async createClientsServers(allowedDirectories: string[]): Promise<void> {
    const client = await createFilesystemClient(allowedDirectories);
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
  }: {
    systemPrompt?: string;
    userPrompt: string;
    previousMessages?: CoreMessage[];
    onMessage: (message: CoreMessage) => void;
    onTextStream: (stream: AsyncIterable<string>) => void;
  }) {
    if (!this.model) {
      throw new Error("Language model not initialized");
    }
    if (this.clients.length === 0) {
      throw new Error("No clients connected.");
    }
    console.log("userPrompt :>>", userPrompt);
    console.log("systemPrompt :>>", systemPrompt);

    let currentMessages = [...previousMessages];
    if (systemPrompt && currentMessages.length === 0)
      currentMessages.push({ role: "system" as const, content: systemPrompt });
    const userMessage = { role: "user" as const, content: userPrompt };
    currentMessages.push(userMessage);
    onMessage(userMessage);

    const lastMessage = currentMessages[currentMessages.length - 1];
    while (lastMessage.role === "user" || lastMessage.role === "tool") {
      console.log("calling model");
      const result = streamText({
        model: this.model,
        maxTokens: 8000,
        maxSteps: 20,
        messages: currentMessages,
        tools: this.toolsForModel,
      });

      onTextStream(result.textStream);
      const assistantMessages = (await result.response).messages;
      console.log("assistantMessages :>>", assistantMessages);

      // Add assistant message(s) to the conversation
      currentMessages.push(...assistantMessages);
      assistantMessages.forEach(onMessage);

      // Handle tool calls
      const toolCalls = await result.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        const toolResults = await Promise.all(
          toolCalls.map(async (toolCall) => {
            const toolName = toolCall.toolName;
            const toolArgs = toolCall.args;

            const client = this.toolsToClientMap[toolName];
            if (!client) {
              throw new Error(`Tool ${toolName} not found`);
            }

            console.log(`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`);
            let toolResult = await client.callTool(toolName, toolArgs);

            return {
              type: "tool-result",
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: toolResult.content[0].text,
            } as ToolResultPart;
          }),
        );

        const toolMessage: CoreToolMessage = {
          role: "tool",
          content: toolResults,
        };
        console.log("toolMessage :>>", toolMessage);
        currentMessages.push(toolMessage);
        onMessage(toolMessage);
      } else {
        break; // Exit loop if no tool calls
      }
    }

    console.log("all messages :>>", currentMessages);
  }

  async cleanup(): Promise<void> {
    for (const client of this.clients) {
      await client.close();
    }
  }
}
