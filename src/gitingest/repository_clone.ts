import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CloneOptions {
    branch?: string;
    depth?: number;
    sparse?: boolean;
    sparsePatterns?: string[];
}

export async function cloneRepository(
    repoUrl: string,
    targetDir: string,
    options: CloneOptions = {}
): Promise<string> {
    // Create target directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });

    const args: string[] = ['clone'];

    if (options.branch) {
        args.push('--branch', options.branch);
    }

    if (options.depth) {
        args.push('--depth', options.depth.toString());
    }

    if (options.sparse) {
        args.push('--sparse');
    }

    args.push(repoUrl, targetDir);

    try {
        await execAsync(`git ${args.join(' ')}`);

        if (options.sparse && options.sparsePatterns) {
            // Change to the target directory
            process.chdir(targetDir);

            // Initialize sparse checkout
            await execAsync('git sparse-checkout init');

            // Set sparse checkout patterns
            await execAsync(`git sparse-checkout set ${options.sparsePatterns.join(' ')}`);
        }

        return targetDir;
    } catch (error) {
        // Clean up on failure
        try {
            await fs.rm(targetDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error('Error cleaning up failed clone:', cleanupError);
        }

        if (error instanceof Error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        }
        throw error;
    }
}

export async function isGitRepository(dirPath: string): Promise<boolean> {
    try {
        const gitDir = path.join(dirPath, '.git');
        const stats = await fs.stat(gitDir);
        return stats.isDirectory();
    } catch (error) {
        return false;
    }
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
    try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get current branch: ${error.message}`);
        }
        throw error;
    }
}

export async function getRemoteUrl(repoPath: string): Promise<string> {
    try {
        const { stdout } = await execAsync('git config --get remote.origin.url', { cwd: repoPath });
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get remote URL: ${error.message}`);
        }
        throw error;
    }
}
