import { TreeGenerator } from "./tree";
import { describe, beforeEach, test, expect, mock } from "bun:test";
import { Volume } from "memfs";

describe("TreeGenerator", () => {
  let treeGenerator: TreeGenerator;
  let mockFs: any;
  let vol: any;

  beforeEach(() => {
    // Create a new volume for each test
    vol = Volume.fromJSON({
      "/test-dir/.git/HEAD": "",
      "/test-dir/file1.txt": "content",
      "/test-dir/.gitignore": "*.log\nnode_modules/",
      "/test-dir/nested-dir/file2.txt": "content",
      "/test-dir/nested-dir/ignored.log": "content",
    });

    // Create mock fs methods
    mockFs = {
      readdirSync: mock((path: string, options?: { withFileTypes: boolean }) => {
        const entries = vol.readdirSync(path);
        if (options?.withFileTypes) {
          return entries.map((entry) => ({
            name: entry,
            isDirectory: () => {
              try {
                return vol.statSync(`${path}/${entry}`).isDirectory();
              } catch {
                return false;
              }
            },
            isFile: () => {
              try {
                return vol.statSync(`${path}/${entry}`).isFile();
              } catch {
                return false;
              }
            },
          }));
        }
        return entries;
      }),
      statSync: mock((path: string) => vol.statSync(path)),
      existsSync: mock((path: string) => vol.existsSync(path)),
      readFileSync: mock((path: string, encoding: string) => vol.readFileSync(path, encoding)),
    };

    // Mock the fs module
    mock.module("fs", () => mockFs);

    treeGenerator = new TreeGenerator();
  });

  test("should generate basic tree structure", () => {
    const result = treeGenerator.generate("/test-dir");
    expect(result).toBe(
      // biome-ignore format: the tree should not be formatted
      "/test-dir\n" +
        "├── .gitignore\n" +
        "├── file1.txt\n" +
        "└── nested-dir\n" +
        "    └── file2.txt",
    );
  });

  test("should respect parent .gitignore", () => {
    const result = treeGenerator.generate("/test-dir/nested-dir");
    expect(result).toBe("/test-dir/nested-dir\n" + "└── file2.txt");
  });

  test("should respect .gitignore rules", () => {
    const result = treeGenerator.generate("/test-dir");
    expect(result).not.toContain("ignored.log");
    expect(result).toContain("file2.txt");
  });

  test("should handle maxDepth correctly", () => {
    treeGenerator = new TreeGenerator({ maxDepth: 1 });
    const result = treeGenerator.generate("/test-dir");
    expect(result).toContain("file1.txt");
    expect(result).toContain("nested-dir");
    expect(result).not.toContain("file2.txt");
  });

  test("should include files matching negated patterns", () => {
    // Update .gitignore and add important.log
    vol.writeFileSync("/test-dir/.gitignore", "*.log\n!important.log");
    vol.writeFileSync("/test-dir/important.log", "content");

    const result = treeGenerator.generate("/test-dir");
    expect(result).toContain("important.log");
  });

  test("should list directories that become empty after filtering", () => {
    // Add empty-dir with a file that's ignored
    vol.mkdirSync("/test-dir/empty-dir");
    vol.writeFileSync("/test-dir/empty-dir/.keep", "content");
    vol.appendFileSync("/test-dir/.gitignore", "\n.keep");

    const result = treeGenerator.generate("/test-dir");
    expect(result).toContain("empty-dir");
    expect(result).not.toContain(".keep");
  });

  test("should apply .gitignore from filesystem root when not in git repo", () => {
    // Remove .git directory and add root .gitignore
    vol.unlinkSync("/test-dir/.git/HEAD");
    vol.rmdirSync("/test-dir/.git");
    vol.writeFileSync("/.gitignore", "global-ignore.txt");
    vol.writeFileSync("/test-dir/global-ignore.txt", "content");

    const result = treeGenerator.generate("/test-dir");
    expect(result).not.toContain("global-ignore.txt");
  });
});
