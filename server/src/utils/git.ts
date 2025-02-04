import { exec } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export function isGitUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("git@") || url.startsWith("git://");
}

export async function cloneRepository(gitUrl: string, cacheDirectory: string): Promise<string> {
  // Ensure cache directory exists
  fs.mkdirSync(cacheDirectory, { recursive: true });

  const repoName = gitUrl.substring(gitUrl.lastIndexOf("/") + 1).replace(".git", "");
  const repoDirectory = path.join(cacheDirectory, repoName);

  if (fs.existsSync(repoDirectory)) {
    console.log(`Repository already exists at ${repoDirectory}, using existing clone.`);
    return repoDirectory;
  }

  try {
    console.log(`Cloning ${gitUrl} to ${repoDirectory}`);
    await execAsync(`git clone ${gitUrl} ${repoDirectory}`);
    return repoDirectory;
  } catch (error: any) {
    fs.rmSync(repoDirectory, { recursive: true, force: true });
    throw new Error(`Failed to clone repository: ${error.message}`); // Re-throw the error
  }
}
