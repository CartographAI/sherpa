import { log } from "../utils/logger.js";
import type { BaseClient } from "./baseClient.js";
import { McpServerConfig, McpServersConfig } from "./mcpManager.js";
import { StdioClient } from "./stdioClient.js";

export class MCPClientFactory {
  /**
   * Creates MCP clients for all configured servers
   * @param config The MCP servers configuration
   * @returns Array of initialized BaseClient instances
   */
  static async createClients(config: McpServersConfig): Promise<BaseClient[]> {
    const clients: BaseClient[] = [];

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        const client = await MCPClientFactory.createClient(serverName, serverConfig);
        clients.push(client);
      } catch (error) {
        log.error(`Failed to create client for ${serverName}:`, error);
        // Continue with other clients even if one fails
      }
    }

    return clients;
  }

  /**
   * Creates and initializes a single MCP client
   * @param serverName Name of the MCP server
   * @param config Configuration for the MCP server
   * @returns Initialized BaseClient instance
   */
  private static async createClient(serverName: string, config: McpServerConfig): Promise<BaseClient> {
    log.debug(`Creating client for ${serverName}`);
    const client = new StdioClient(serverName, config);
    await client.connect();
    return client;
  }
}
