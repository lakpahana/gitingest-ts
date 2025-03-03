import * as path from 'path';
import * as fs from 'fs/promises';
import { ParsedQuery, IngestResult } from './types';
import { parseQuery } from './query_parser';
import { ingestRepository } from './query_ingestion';
import { cloneRepository, isGitRepository, getRemoteUrl, getCurrentBranch } from './repository_clone';
import { MAX_TOTAL_SIZE_BYTES } from './confg';

export interface RepositoryIngestOptions {
    ignorePatterns?: string[];
    includePatterns?: string[];
    branch?: string;
    depth?: number;
    sparse?: boolean;
    sparsePatterns?: string[];
}

export interface RepositoryInfo {
    path: string;
    isGit: boolean;
    remoteUrl?: string;
    currentBranch?: string;
}

/**
 * Get information about a repository
 * @param repoPath Path to the repository
 * @returns Repository information including git status
 */
export async function getRepositoryInfo(repoPath: string): Promise<RepositoryInfo> {
    const isGit = await isGitRepository(repoPath);
    const info: RepositoryInfo = {
        path: repoPath,
        isGit
    };

    if (isGit) {
        try {
            info.remoteUrl = await getRemoteUrl(repoPath);
            info.currentBranch = await getCurrentBranch(repoPath);
        } catch (error) {
            console.warn('Error getting git repository details:', error);
        }
    }

    return info;
}

/**
 * Calculate the total size of a directory
 * @param dirPath Directory path to calculate size for
 * @returns Total size in bytes
 */
async function calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    async function processItem(itemPath: string): Promise<void> {
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
            const entries = await fs.readdir(itemPath);
            for (const entry of entries) {
                await processItem(path.join(itemPath, entry));
            }
        } else {
            totalSize += stats.size;
        }
    }

    await processItem(dirPath);
    return totalSize;
}

/**
 * Ingest a local repository
 * @param repoPath Path to the local repository
 * @param options Repository ingestion options
 * @returns Ingestion result containing summary, structure, and content
 */
export async function ingestLocalRepository(
    repoPath: string,
    options: RepositoryIngestOptions = {}
): Promise<IngestResult> {
    // Check if directory exists
    try {
        await fs.access(repoPath);
    } catch (error) {
        throw new Error(`Repository path does not exist: ${repoPath}`);
    }

    // Check repository size
    const totalSize = await calculateDirectorySize(repoPath);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
        throw new Error(
            `Repository size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size ` +
            `(${(MAX_TOTAL_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB)`
        );
    }

    // Create query with options
    const query = parseQuery(repoPath, options.ignorePatterns, options.includePatterns);
    
    // Perform ingestion
    return ingestRepository(repoPath, query);
}

/**
 * Ingest a remote repository by first cloning it
 * @param repoUrl URL of the remote repository
 * @param options Repository ingestion options
 * @returns Ingestion result containing summary, structure, and content
 */
export async function ingestRemoteRepository(
    repoUrl: string,
    options: RepositoryIngestOptions = {}
): Promise<IngestResult> {
    // Create temporary directory for cloning
    const tempDir = path.join(process.cwd(), '.gitingest-temp', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Clone the repository
        const clonePath = await cloneRepository(repoUrl, tempDir, {
            branch: options.branch,
            depth: options.depth,
            sparse: options.sparse,
            sparsePatterns: options.sparsePatterns
        });

        // Ingest the cloned repository
        return await ingestLocalRepository(clonePath, options);
    } finally {
        // Clean up temporary directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Error cleaning up temporary directory:', error);
        }
    }
}

/**
 * Main entry point for repository ingestion
 * @param repoPathOrUrl Local path or URL of the repository
 * @param options Repository ingestion options
 * @returns Ingestion result containing summary, structure, and content
 */
export async function ingest(
    repoPathOrUrl: string,
    options: RepositoryIngestOptions = {}
): Promise<IngestResult> {
    // Check if input is a URL
    const isUrl = repoPathOrUrl.startsWith('http://') || 
                 repoPathOrUrl.startsWith('https://') ||
                 repoPathOrUrl.startsWith('git://') ||
                 repoPathOrUrl.startsWith('ssh://');

    if (isUrl) {
        return ingestRemoteRepository(repoPathOrUrl, options);
    } else {
        return ingestLocalRepository(repoPathOrUrl, options);
    }
}
