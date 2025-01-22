import * as fs from "fs";
import * as path from "path";

interface TreeOptions {
  maxDepth?: number;
}

interface FileNode {
  name: string;
  type: "file";
  path: string;
}

interface DirectoryNode {
  name: string;
  type: "directory";
  path: string;
  children: TreeNode[];
}

type TreeNode = FileNode | DirectoryNode;

export class TreeGenerator {
  private indent = "│   ";
  private branch = "├── ";
  private lastBranch = "└── ";
  private output: string[] = [];

  constructor(private options: TreeOptions = {}) {
    this.options = {
      maxDepth: Infinity,
      ...options,
    };
  }

  public generate(targetPath: string): string {
    this.output = [];
    this.output.push(targetPath);
    this.processDirectory(targetPath);
    return this.output.join("\n");
  }

  public generateTree(targetPath: string): TreeNode {
    return this.buildDirectoryTree(targetPath);
  }

  private processDirectory(dirPath: string, prefix = "", level = 0): void {
    if (level >= this.options.maxDepth!) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isLast = i === entries.length - 1;
        const currentPrefix = prefix + (isLast ? this.lastBranch : this.branch);
        const nextPrefix = prefix + (isLast ? "    " : this.indent);
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.output.push(currentPrefix + entry.name);
          this.processDirectory(fullPath, nextPrefix, level + 1);
        } else if (entry.isFile()) {
          this.output.push(currentPrefix + entry.name);
        }
      }
    } catch (error) {
      this.output.push(`${prefix}[Error reading directory: ${error}]`);
    }
  }

  private buildDirectoryTree(dirPath: string): TreeNode {
    const stats = fs.statSync(dirPath);
    const baseName = path.basename(dirPath);

    if (!stats.isDirectory()) {
      return {
        name: baseName,
        type: "file",
        path: dirPath,
      };
    }

    const children: TreeNode[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        children.push(this.buildDirectoryTree(fullPath));
      } else if (entry.isFile()) {
        children.push({
          name: entry.name,
          type: "file",
          path: fullPath,
        });
      }
    }

    return {
      name: baseName,
      type: "directory",
      path: dirPath,
      children,
    };
  }
}

export type { TreeNode, FileNode, DirectoryNode, TreeOptions };
