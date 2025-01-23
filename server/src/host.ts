import { createAnthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  jsonSchema,
  type CoreMessage,
  type CoreTool,
  type CoreToolMessage,
  type LanguageModelV1,
  type ToolResultPart,
} from "ai";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import type { BaseClient } from "./baseClient";

import { createFilesystemClient } from "./filesystemClient";

export async function createHost({ model, apiKey }: { model: string; apiKey: string }) {
  const anthropic = createAnthropic({ apiKey });
  const languageModel = anthropic(model);
  const host = new Host(languageModel);
  await host.createClientsServers();
  return host;
}

export class Host {
  model: LanguageModelV1;
  clients: BaseClient[] = [];
  toolsForModel: Record<string, CoreTool> = {};
  toolsToClientMap: Record<string, BaseClient> = {};

  constructor(model: LanguageModelV1) {
    this.model = model;
  }

  async createClientsServers(): Promise<void> {
    const client = await createFilesystemClient(["."]); // TODO: pass in allowedDirectories
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
    onStepComplete,
  }: { systemPrompt?: string; userPrompt: string; onStepComplete?: (message: CoreMessage) => void }): Promise<string> {
    if (this.clients.length === 0) {
      throw new Error("No clients connected.");
    }
    console.log("userPrompt :>>", userPrompt);
    console.log("systemPrompt :>>", systemPrompt);

    let currentMessages: CoreMessage[] = [];
    if (systemPrompt) currentMessages.push({ role: "system" as const, content: systemPrompt });
    currentMessages.push({ role: "user" as const, content: userPrompt });
    let finalText: string[] = [userPrompt];

    const lastMessage = currentMessages[currentMessages.length - 1];
    while (lastMessage.role === "user" || lastMessage.role === "tool") {
      console.log("calling model");
      const response = await generateText({
        model: this.model,
        maxTokens: 8000,
        maxSteps: 20,
        messages: currentMessages,
        tools: this.toolsForModel,
      });
      const assistantMessages = response.response.messages;
      console.log("assistantMessages :>>", assistantMessages);

      // Add assistant message(s) to the conversation
      currentMessages.push(...assistantMessages);
      if (onStepComplete) assistantMessages.forEach(onStepComplete);

      // Add the model's text response to finalText
      if (response.text) {
        finalText.push(response.text);
      }

      // Handle tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await Promise.all(
          response.toolCalls.map(async (toolCall) => {
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
        if (onStepComplete) onStepComplete(toolMessage);
      } else {
        break; // Exit loop if no tool calls
      }
    }

    console.log("all messages :>>", currentMessages);
    return finalText.join("\n");
  }

  async chatLoop(): Promise<void> {
    const rl = readline.createInterface({ input, output });

    console.log("\nMCP Client Started!");
    console.log("Type your queries or 'quit' to exit.");

    while (true) {
      try {
        const query = await rl.question("\nQuery: ");
        if (query.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery({ userPrompt: query });
        console.log("\n" + response);
      } catch (e: any) {
        console.error(`\nError: ${e.message}`);
      }
    }

    rl.close();
  }

  async cleanup(): Promise<void> {
    for (const client of this.clients) {
      await client.close();
    }
  }
}
