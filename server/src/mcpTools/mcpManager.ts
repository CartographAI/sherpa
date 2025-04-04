import { readFile, writeFile, mkdir } from "node:fs/promises";
import { configDirectory, mcpConfigPath } from "../config.js";
import { log } from "../utils/logger.js";
import { MCPClientFactory } from "./mcpClientFactory.js";

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
  const stdioClients = await MCPClientFactory.createClients(mcpConfig);
  return stdioClients;
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
