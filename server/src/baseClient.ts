import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  type CallToolResult,
  type ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

export abstract class BaseClient {
  session: Client | null = null;

  abstract connect(): Promise<void>;

  async callTool(toolName: string, toolArgs: any): Promise<CallToolResult> {
    if (!this.session) {
      throw new Error("Not connected to server");
    }
    return await this.session.request(
      {
        method: "tools/call",
        params: {
          name: toolName,
          arguments: toolArgs,
        },
      },
      CallToolResultSchema,
    );
  }
  async listTools(): Promise<ListToolsResult> {
    if (!this.session) {
      throw new Error("Not connected to server");
    }
    return await this.session.request({ method: "tools/list" }, ListToolsResultSchema);
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
    }
  }
}
