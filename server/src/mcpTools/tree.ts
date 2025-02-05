import ignore from "ignore";
import * as fs from "node:fs";
import * as path from "node:path";

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
    this.output.push(path.basename(targetPath));
    this.processDirectory(targetPath);
    return this.output.join("\n");
  }

  public generateTree(targetPath: string, baseDir: string): TreeNode {
    return this.buildDirectoryTree(targetPath, baseDir);
  }

  private processDirectory(dirPath: string, prefix = "", level = 0): void {
    if (level >= this.options.maxDepth!) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const filteredEntries = this.filterIgnoredEntries(dirPath, entries);

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const isLast = i === filteredEntries.length - 1;
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

  private buildDirectoryTree(dirPath: string, baseDir: string = dirPath): TreeNode {
    const stats = fs.statSync(dirPath);
    const baseName = path.basename(dirPath);
    const relativePath = path.relative(baseDir, dirPath);

    if (!stats.isDirectory()) {
      return {
        name: baseName,
        type: "file",
        path: relativePath || ".", // Use "." for the root file
      };
    }

    const children: TreeNode[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const filteredEntries = this.filterIgnoredEntries(dirPath, entries);

    for (const entry of filteredEntries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        children.push(this.buildDirectoryTree(fullPath, baseDir));
      } else if (entry.isFile()) {
        children.push({
          name: entry.name,
          type: "file",
          path: path.relative(baseDir, fullPath),
        });
      }
    }

    return {
      name: baseName,
      type: "directory",
      path: relativePath || ".", // Use "." for the root directory
      children,
    };
  }
  private readonly EXCLUDED_DIRECTORIES = new Set([".git"]);

  private filterIgnoredEntries(dirPath: string, entries: fs.Dirent[]): fs.Dirent[] {
    const ig = this.loadIgnoreRules(dirPath);
    const baseDir = this.findBaseDir(dirPath);

    const filteredEntries = entries.filter((entry) => !this.EXCLUDED_DIRECTORIES.has(entry.name));

    return filteredEntries.filter((entry) => {
      const entryPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, entryPath);

      // If it's a directory, append a trailing slash to match directory-specific patterns
      const pathToCheck = entry.isDirectory() ? `${relativePath}/` : relativePath;

      return !ig.ignores(pathToCheck);
    });
  }

  private loadIgnoreRules(dirPath: string): ReturnType<typeof ignore> {
    const gitRoot = this.findGitRoot(dirPath);
    const baseDir = gitRoot || this.getFilesystemRoot(dirPath);
    const dirs = gitRoot ? this.getDirsFromGitRoot(gitRoot, dirPath) : this.getDirsFromFilesystemRoot(dirPath);

    const ig = ignore();
    let currentIg = ignore();

    for (const dir of dirs) {
      const relativeDir = path.relative(baseDir, dir);
      if (relativeDir && currentIg.ignores(relativeDir)) {
        continue;
      }

      const gitignorePath = path.join(dir, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        try {
          const content = fs.readFileSync(gitignorePath, "utf-8");
          const rules = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"))
            .map((line) => {
              const ruleDir = path.relative(baseDir, dir);
              return ruleDir === "." ? line : path.join(ruleDir, line);
            });

          currentIg = ignore().add(rules);
          ig.add(rules);
        } catch (error) {
          // Ignore unreadable .gitignore
        }
      }
    }

    return ig;
  }

  private findGitRoot(currentDir: string): string | null {
    let dir = path.resolve(currentDir);
    while (true) {
      const gitDir = path.join(dir, ".git");
      try {
        if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
          return dir;
        }
      } catch (error) {
        // Ignore errors
      }
      const parentDir = path.dirname(dir);
      if (parentDir === dir) break; // Reached filesystem root
      dir = parentDir;
    }
    return null;
  }

  private getDirsFromGitRoot(gitRoot: string, currentDir: string): string[] {
    const dirs: string[] = [];
    let current = gitRoot;
    dirs.push(current);

    const relativePath = path.relative(gitRoot, currentDir).split(path.sep);
    for (const part of relativePath) {
      if (!part) continue;
      current = path.join(current, part);
      dirs.push(current);
    }

    return dirs;
  }

  private getDirsFromFilesystemRoot(dirPath: string): string[] {
    let current = path.resolve(dirPath);
    const ancestors: string[] = [];

    while (true) {
      ancestors.push(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return ancestors.reverse();
  }

  private findBaseDir(dirPath: string): string {
    const gitRoot = this.findGitRoot(dirPath);
    return gitRoot || this.getFilesystemRoot(dirPath);
  }

  private getFilesystemRoot(dirPath: string): string {
    let root = path.resolve(dirPath);
    while (path.dirname(root) !== root) {
      root = path.dirname(root);
    }
    return root;
  }
}

export type { DirectoryNode, FileNode, TreeNode, TreeOptions };
