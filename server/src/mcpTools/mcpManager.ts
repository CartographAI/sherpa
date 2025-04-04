import { readFile, writeFile, mkdir } from "node:fs/promises";
import { configDirectory, mcpConfigPath } from "../config.js";
import { log } from "../utils/logger.js";
import type { BaseClient } from "./baseClient.js";
import { StdioClient } from "./stdioClient.js";

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

const defaultMcpConfig: McpServersConfig = { mcpServers: {} };

export async function createClients() {
  const mcpConfig = await loadMcpConfig();
  const stdioClients = await createAllClients(mcpConfig);
  return stdioClients;
}

/**
 * Creates and initializes a single MCP client
 * @param serverName Name of the MCP server
 * @param config Configuration for the MCP server
 * @returns Initialized BaseClient instance
 */
async function createClient(serverName: string, config: McpServerConfig): Promise<BaseClient> {
  log.debug(`Creating client for ${serverName}`);
  const client = new StdioClient(serverName, config);
  await client.connect();
  return client;
}

/**
 * Creates MCP clients for all configured servers
 * @param config The MCP servers configuration
 * @returns Array of initialized BaseClient instances
 */
async function createAllClients(config: McpServersConfig): Promise<BaseClient[]> {
  const clients: BaseClient[] = [];

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = await createClient(serverName, serverConfig);
      clients.push(client);
    } catch (error) {
      log.error(`Failed to create client for ${serverName}:`, error);
      // Continue with other clients even if one fails
    }
  }

  return clients;
}

/**
 * Loads the MCP server configuration from the JSON file.
 * Creates a default config file if it doesn't exist.
 * Returns default (empty) config if reading/parsing fails
 * @returns The loaded or default MCPServersConfig.
 */
export async function loadMcpConfig(): Promise<McpServersConfig> {
  try {
    const configFileContent = await readFile(mcpConfigPath, "utf-8");
    const config = JSON.parse(configFileContent);
    log.debug("Loaded MCP config from:", mcpConfigPath);
    // TODO: Add schema validation here later if needed
    return config;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      log.debug(`MCP config file not found at ${mcpConfigPath}. Creating default.`);
      try {
        await mkdir(configDirectory, { recursive: true });
        await writeFile(mcpConfigPath, JSON.stringify(defaultMcpConfig, null, 2));
        log.info(`Created default MCP config file at ${mcpConfigPath}`);
        return defaultMcpConfig;
      } catch (writeError) {
        log.error("Failed to create default MCP config file:", writeError);
        return defaultMcpConfig;
      }
    } else {
      log.error(`Failed to read or parse MCP config file at ${mcpConfigPath}:`, error);
      return defaultMcpConfig;
    }
  }
}
