import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateMessageRequestSchema, ProgressNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

import { log } from "../utils/logger.js";
import { BaseClient } from "./baseClient.js";
import type { MCPServerConfig } from "./mcpServersConfig.js";

export class StdioClient extends BaseClient {
  private config: MCPServerConfig;
  private clientName: string;

  constructor(serverName: string, config: MCPServerConfig) {
    super();
    this.config = config;
    this.clientName = `mcp-${serverName}-client`;
  }

  async connect(): Promise<void> {
    console.log("this.config :>> ", this.config);
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
    });

    const client = new Client(
      {
        name: this.clientName,
        version: "0.1.0",
      },
      {
        capabilities: {
          experimental: {},
          sampling: {},
          roots: {},
        },
      },
    );

    await client.connect(transport);
    log.debug(`${this.clientName} connected to MCP server`);
    this.session = client;

    const response = await this.listTools();
    const tools = response.tools;
    log.debug(
      `${this.clientName} tools:`,
      tools.map((tool) => tool.name),
    );

    client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      log.debug(`${this.clientName} got MCP notif`, notification);
    });

    client.setRequestHandler(CreateMessageRequestSchema, (request) => {
      log.debug(`${this.clientName} got MCP request`, request);
      return { _meta: {} };
    });
  }
}
