import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CreateMessageRequestSchema, ProgressNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

import { BaseClient } from "./baseClient.js";
import { createServer } from "./mcpFilesystem.js";

export class FilesystemClient extends BaseClient {
  allowedDirectory: string;
  clientName: string = "mcp-filesystem-client";

  constructor(allowedDirectory: string) {
    super();
    this.allowedDirectory = allowedDirectory;
  }

  async connect(): Promise<void> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = await createServer(this.allowedDirectory);
    server.connect(serverTransport);

    const client = new Client(
      {
        name: this.clientName,
        version: "0.0.1",
      },
      {
        capabilities: {
          experimental: {},
          sampling: {},
          roots: {},
        },
      },
    );
    await client.connect(clientTransport);
    console.log(`${this.clientName} connected to MCP server`);
    this.session = client;
    const response = await this.listTools();
    const tools = response.tools;
    console.log(
      `${this.clientName} tools:`,
      tools.map((tool) => tool.name),
    );

    client.setNotificationHandler(ProgressNotificationSchema, (notification) => {
      console.log(`${this.clientName} got MCP notif`, notification);
    });

    client.setRequestHandler(CreateMessageRequestSchema, (request) => {
      console.log(`${this.clientName} got MCP request`, request);
      return { _meta: {} };
    });
  }
}

export async function createFilesystemClient(allowedDirectory: string): Promise<FilesystemClient> {
  const client = new FilesystemClient(allowedDirectory);
  await client.connect();
  return client;
}
