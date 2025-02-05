import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { log } from "../utils/logger.js";
import { TreeGenerator } from "./tree.js";

// Normalize all paths consistently
function normalizePath(p: string): string {
  return path.normalize(p);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Security utilities
async function validatePath(requestedPath: string, normalizedAllowedDirectory: string): Promise<string> {
  const expandedPath = expandHome(requestedPath);
  const absolute = path.isAbsolute(expandedPath)
    ? path.resolve(expandedPath)
    : path.resolve(process.cwd(), expandedPath);

  const normalizedRequested = normalizePath(absolute);

  // Check if path is within allowed directories
  const isAllowed = normalizedRequested.startsWith(normalizedAllowedDirectory);
  if (!isAllowed) {
    throw new Error(
      `Access denied - path outside allowed directories: ${absolute} not in ${normalizedAllowedDirectory}`,
    );
  }

  // Handle symlinks by checking their real path
  try {
    const realPath = await fs.realpath(absolute);
    const normalizedReal = normalizePath(realPath);
    const isRealPathAllowed = normalizedReal.startsWith(normalizedAllowedDirectory);
    if (!isRealPathAllowed) {
      throw new Error("Access denied - symlink target outside allowed directories");
    }
    return realPath;
  } catch (error) {
    // For new files that don't exist yet, verify parent directory
    const parentDir = path.dirname(absolute);
    try {
      const realParentPath = await fs.realpath(parentDir);
      const normalizedParent = normalizePath(realParentPath);
      const isParentAllowed = normalizedParent.startsWith(normalizedAllowedDirectory);
      if (!isParentAllowed) {
        throw new Error("Access denied - parent directory outside allowed directories");
      }
      return absolute;
    } catch {
      throw new Error(`Parent directory does not exist: ${parentDir}`);
    }
  }
}

// Schema definitions
const ReadFilesArgsSchema = z.object({
  paths: z.array(z.string()),
});

const TreeArgsSchema = z.object({
  path: z.string(),
  maxDepth: z.number().nullable(),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Start server
export async function createServer(allowedDirectory: string) {
  // Validate that all directories exist and are accessible
  try {
    const stats = await fs.stat(allowedDirectory);
    if (!stats.isDirectory()) {
      log.error(`Error: ${allowedDirectory} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Error accessing directory ${allowedDirectory}:`, error);
    process.exit(1);
  }
  // Store allowed directories in normalized form
  const normalizedAllowedDirectory = normalizePath(path.resolve(expandHome(allowedDirectory)));

  // Server setup
  const server = new Server(
    {
      name: "secure-filesystem-server",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "read_files",
          description:
            "Read the contents of one or more multiple files. " +
            "Use this to analyze file contents. " +
            "Each file's content is returned with its path as a reference. " +
            "Failed reads for individual files won't stop " +
            "the entire operation. Only works within allowed directories. " +
            "Specify the path as absolute paths, do not assume the directory that you are being run from.",
          inputSchema: zodToJsonSchema(ReadFilesArgsSchema) as ToolInput,
        },
        {
          name: "tree",
          description:
            "Generate a tree-style visualization of a directory structure. " +
            "Shows the hierarchy of files and directories in a readable format. " +
            "Use this to understand what files are available. " +
            "Optionally specify maxDepth to limit the depth of the tree. " +
            "Only works within allowed directories. " +
            "Specify the path as absolute paths, do not assume the directory that you are being run from.",
          inputSchema: zodToJsonSchema(TreeArgsSchema) as ToolInput,
        },
        {
          name: "list_allowed_directories",
          description:
            "Returns the list of directories that this server is allowed to access. " +
            "Use this to understand which directories are available before trying to access files.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "read_files": {
          const parsed = ReadFilesArgsSchema.safeParse(args);
          if (!parsed.success) {
            throw new Error(`Invalid arguments for read_files: ${parsed.error}`);
          }
          const results = await Promise.all(
            parsed.data.paths.map(async (filePath: string) => {
              try {
                const validPath = await validatePath(filePath, normalizedAllowedDirectory);
                const content = await fs.readFile(validPath, "utf-8");
                let processedContent = content
                  .split("\n")
                  .map((line, i) => `L${i + 1}: ${line}`)
                  .join("\n");
                return `<${filePath}>\n${processedContent}\n</${filePath}>`;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return `${filePath}: Error - ${errorMessage}`;
              }
            }),
          );
          return {
            content: [{ type: "text", text: results.join("\n\n") }],
          };
        }
        case "tree": {
          const parsed = TreeArgsSchema.safeParse(args);
          if (!parsed.success) {
            throw new Error(`Invalid arguments for tree: ${parsed.error}`);
          }
          const validPath = await validatePath(parsed.data.path, normalizedAllowedDirectory);
          const tree = new TreeGenerator({
            maxDepth: parsed.data.maxDepth ?? undefined,
          });
          const treeOutput = tree.generate(validPath);
          return {
            content: [{ type: "text", text: treeOutput }],
          };
        }
        case "list_allowed_directories": {
          return {
            content: [
              {
                type: "text",
                text: `Allowed directory:\n${normalizedAllowedDirectory}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  log.info("Secure MCP Filesystem Server running on local transport");
  log.info("Allowed directory:", normalizedAllowedDirectory);

  return server;
}
