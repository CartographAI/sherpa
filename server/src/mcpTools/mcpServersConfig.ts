interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// Configure MCP servers here. Currently only stdio servers are supported.
const config: MCPServersConfig = {
  mcpServers: {},
};

export type { MCPServerConfig, MCPServersConfig };
export default config;
