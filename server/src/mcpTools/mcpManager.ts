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

interface McpServersConfigFile {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpServerStatus extends McpServerConfig {
  status: "connected" | "error" | "pending";
  error?: string;
}

export interface McpServersStatusConfig {
  mcpServers: Record<string, McpServerStatus>;
}

const defaultMcpConfig: McpServersConfigFile = { mcpServers: {} };

class McpManager {
  private config: McpServersStatusConfig = { mcpServers: {} };
  private connectedClients: Map<string, BaseClient> = new Map();
  private isInitialized = false;

  private async loadMcpConfigFile(): Promise<McpServersConfigFile> {
    try {
      const configFileContent = await readFile(mcpConfigPath, "utf-8");
      const loadedConfig = JSON.parse(configFileContent);
      log.debug("Loaded MCP config from:", mcpConfigPath);
      return loadedConfig;
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

  /**
   * Initializes the McpManager by loading the config and attempting to connect to each server.
   * This should only be called once during application startup.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      log.warn("McpManager already initialized.");
      return;
    }

    log.info("Initializing MCP Manager...");
    const rawConfig = await this.loadMcpConfigFile();

    this.config = { mcpServers: {} };
    for (const [serverName, serverConfig] of Object.entries(rawConfig.mcpServers)) {
      this.config.mcpServers[serverName] = {
        ...serverConfig,
        status: "pending",
      };
    }

    const clientPromises = Object.entries(rawConfig.mcpServers).map(async ([serverName, serverConfig]) => {
      try {
        log.debug(`Attempting to connect to MCP server: ${serverName}`);
        const client = new StdioClient(serverName, serverConfig);
        await client.connect();
        this.connectedClients.set(serverName, client);
        this.config.mcpServers[serverName].status = "connected";
        log.info(`Successfully connected to MCP server: ${serverName}`);
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.config.mcpServers[serverName].status = "error";
        this.config.mcpServers[serverName].error = errorMessage;
        log.error(`Failed to connect to MCP server ${serverName}:`, errorMessage);
      }
    });

    await Promise.all(clientPromises);

    this.isInitialized = true;
    log.info("MCP Manager initialization complete.");
  }

  getConnectedClients(): Map<string, BaseClient> {
    if (!this.isInitialized) {
      throw new Error("McpManager not initialized. Call initialize() first.");
    }
    return this.connectedClients;
  }

  getConfigWithStatus(): McpServersStatusConfig {
    if (!this.isInitialized && Object.keys(this.config.mcpServers).length === 0) {
      log.warn("getConfigWithStatus called before initialization and config load, returning empty.");
      return { mcpServers: {} };
    }
    if (!this.isInitialized) {
      log.warn("getConfigWithStatus called before initialization completed. Statuses may be pending.");
    }
    return this.config;
  }

  /**
   * Closes connections for all managed clients.
   */
  async cleanup(): Promise<void> {
    log.info("Cleaning up MCP Manager connections...");
    const cleanupPromises = Array.from(this.connectedClients.values()).map((client) => client.close());
    await Promise.allSettled(cleanupPromises);
    this.connectedClients.clear();
    this.isInitialized = false;
    log.info("MCP Manager cleanup complete.");
  }
}

export const mcpManager = new McpManager();
