import * as fs from 'fs/promises';
import * as path from 'path';
import { ParsedQuery, FileNode, IngestResult, FileStats } from './types';
import {
    MaxFilesReachedError,
    MaxFileSizeReachedError,
    AlreadyVisitedError,
    InvalidNotebookError
} from './exceptions';
import { MAX_FILE_SIZE, MAX_FILES } from './confg';
import { processNotebook } from './notebook_utils';
import { fnmatch } from './utils';

async function normalizePath(filePath: string): Promise<string> {
    return path.normalize(filePath);
}

function normalizePathStr(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

function shouldExclude(filePath: string, basePath: string, ignorePatterns: Set<string>): boolean {
    try {
        const relPath = path.relative(basePath, filePath);
        for (const pattern of ignorePatterns) {
            if (pattern && fnmatch(relPath, pattern)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        return true;
    }
}

function shouldInclude(filePath: string, basePath: string, includePatterns: Set<string>): boolean {
    if (includePatterns.size === 0) {
        return true;
    }
    try {
        const relPath = path.relative(basePath, filePath);
        for (const pattern of includePatterns) {
            if (fnmatch(relPath, pattern)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function isTextFile(filePath: string): Promise<boolean> {
    try {
        const buffer = Buffer.alloc(1024);
        const file = await fs.open(filePath, 'r');
        const { bytesRead } = await file.read(buffer, 0, 1024, 0);
        await file.close();

        if (bytesRead === 0) return true;

        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

async function readFileContent(filePath: string): Promise<string> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        if (error instanceof Error) {
            return `Error reading file: ${error.message}`;
        }
        return 'Unknown error reading file';
    }
}

async function isSafeSymlink(symlinkPath: string, basePath: string): Promise<boolean> {
    try {
        const targetPath = await fs.realpath(symlinkPath);
        const baseResolved = await fs.realpath(basePath);
        
        return targetPath.startsWith(baseResolved);
    } catch (error) {
        return false;
    }
}

function sortChildren(children: FileNode[]): FileNode[] {
    return children.sort((a, b) => {
        // README.md files first
        if (a.name.toLowerCase() === 'readme.md') return -1;
        if (b.name.toLowerCase() === 'readme.md') return 1;

        const aIsHidden = a.name.startsWith('.');
        const bIsHidden = b.name.startsWith('.');
        
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? 1 : -1;
        }
        
        if (aIsHidden !== bIsHidden) {
            return aIsHidden ? 1 : -1;
        }
        
        return a.name.localeCompare(b.name);
    });
}

async function processFile(filePath: string, parentNode: FileNode, stats: FileStats): Promise<void> {
    const fileStats = await fs.stat(filePath);
    
    if (stats.totalFiles >= MAX_FILES) {
        throw new MaxFilesReachedError(MAX_FILES);
    }

    if (fileStats.size > MAX_FILE_SIZE) {
        throw new MaxFileSizeReachedError(MAX_FILE_SIZE);
    }

    stats.totalFiles++;
    stats.totalSize += fileStats.size;

    const fileNode: FileNode = {
        name: path.basename(filePath),
        path: filePath,
        size: fileStats.size,
        isDirectory: false
    };

    if (await isTextFile(filePath)) {
        if (filePath.endsWith('.ipynb')) {
            try {
                fileNode.content = await processNotebook(filePath);
            } catch (error) {
                throw new InvalidNotebookError(`Error processing notebook ${filePath}: ${error}`);
            }
        } else {
            fileNode.content = await readFileContent(filePath);
        }
    }

    parentNode.children = parentNode.children || [];
    parentNode.children.push(fileNode);
}

async function processSymlink(
    symlinkPath: string,
    query: ParsedQuery,
    parentNode: FileNode,
    seenPaths: Set<string>,
    stats: FileStats,
    depth: number
): Promise<void> {
    if (!await isSafeSymlink(symlinkPath, query.repository)) {
        return;
    }

    const targetPath = await fs.realpath(symlinkPath);
    if (seenPaths.has(targetPath)) {
        throw new AlreadyVisitedError(targetPath);
    }

    seenPaths.add(targetPath);
    const targetStats = await fs.stat(targetPath);

    if (targetStats.isDirectory()) {
        const childNode = await scanDirectory(targetPath, query, seenPaths, depth + 1, stats);
        if (childNode) {
            parentNode.children = parentNode.children || [];
            parentNode.children.push(childNode);
        }
    } else {
        await processFile(targetPath, parentNode, stats);
    }
}

async function scanDirectory(
    dirPath: string,
    query: ParsedQuery,
    seenPaths: Set<string>,
    depth: number,
    stats: FileStats
): Promise<FileNode | null> {
    if (depth > query.maxDirectoryDepth) {
        return null;
    }

    const dirStats = await fs.stat(dirPath);
    const node: FileNode = {
        name: path.basename(dirPath),
        path: dirPath,
        size: dirStats.size,
        isDirectory: true,
        children: []
    };

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            
            if (shouldExclude(entryPath, query.repository, query.ignorePatterns)) {
                continue;
            }

            if (!shouldInclude(entryPath, query.repository, query.includePatterns)) {
                continue;
            }

            try {
                if (entry.isSymbolicLink()) {
                    await processSymlink(entryPath, query, node, seenPaths, stats, depth);
                } else if (entry.isDirectory()) {
                    const childNode = await scanDirectory(entryPath, query, seenPaths, depth + 1, stats);
                    if (childNode) {
                        node.children?.push(childNode);
                    }
                } else {
                    await processFile(entryPath, node, stats);
                }
            } catch (error) {
                if (error instanceof MaxFilesReachedError || error instanceof MaxFileSizeReachedError) {
                    throw error;
                }
                console.error(`Error processing ${entryPath}:`, error);
            }
        }

        if (node.children) {
            node.children = sortChildren(node.children);
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        return null;
    }

    return node;
}

function extractFilesContent(query: ParsedQuery, node: FileNode, files: FileNode[] = []): FileNode[] {
    if (!node.isDirectory && node.content) {
        files.push(node);
    }

    if (node.children) {
        for (const child of node.children) {
            extractFilesContent(query, child, files);
        }
    }

    return files;
}

function createFileContentString(files: FileNode[]): string {
    return files.map(file => {
        const header = '='.repeat(80);
        return `${header}\n${normalizePathStr(file.path)}\n${header}\n${file.content}\n`;
    }).join('\n');
}

function createSummaryString(query: ParsedQuery, node: FileNode, stats: FileStats): string {
    const lines: string[] = [];
    lines.push(`Repository: ${query.repository}`);
    lines.push(`Total files analyzed: ${stats.totalFiles}`);
    lines.push(`Total content size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (query.ignorePatterns.size > 0) {
        lines.push('\nIgnore patterns:');
        for (const pattern of query.ignorePatterns) {
            lines.push(`  ${pattern}`);
        }
    }

    if (query.includePatterns.size > 0) {
        lines.push('\nInclude patterns:');
        for (const pattern of query.includePatterns) {
            lines.push(`  ${pattern}`);
        }
    }

    return lines.join('\n');
}

function createTreeStructure(query: ParsedQuery, node: FileNode, prefix: string = '', isLast: boolean = true): string {
    const lines: string[] = [];
    const nodePrefix = prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    lines.push(nodePrefix + node.name);

    if (node.children) {
        const sortedChildren = [...node.children];
        for (let i = 0; i < sortedChildren.length; i++) {
            const child = sortedChildren[i];
            const isLastChild = i === sortedChildren.length - 1;
            lines.push(createTreeStructure(query, child, childPrefix, isLastChild));
        }
    }

    return lines.join('\n');
}

export async function ingestRepository(repository: string, query: ParsedQuery): Promise<IngestResult> {
    const stats: FileStats = {
        totalFiles: 0,
        totalSize: 0
    };
    
    const seenPaths = new Set<string>();
    const rootNode = await scanDirectory(repository, query, seenPaths, 0, stats);
    
    if (!rootNode) {
        throw new Error('No files found in repository');
    }

    const files = extractFilesContent(query, rootNode);
    const content = createFileContentString(files);
    const structure = createTreeStructure(query, rootNode);
    const summary = createSummaryString(query, rootNode, stats);

    return {
        summary,
        structure,
        content
    };
}

export async function ingestFile(filePath: string, query: ParsedQuery): Promise<IngestResult> {
    const stats: FileStats = {
        totalFiles: 1,
        totalSize: 0
    };

    const fileStats = await fs.stat(filePath);
    stats.totalSize = fileStats.size;

    if (fileStats.size > MAX_FILE_SIZE) {
        throw new MaxFileSizeReachedError(MAX_FILE_SIZE);
    }

    const node: FileNode = {
        name: path.basename(filePath),
        path: filePath,
        size: fileStats.size,
        isDirectory: false
    };

    if (await isTextFile(filePath)) {
        if (filePath.endsWith('.ipynb')) {
            try {
                node.content = await processNotebook(filePath);
            } catch (error) {
                throw new InvalidNotebookError(`Error processing notebook ${filePath}: ${error}`);
            }
        } else {
            node.content = await readFileContent(filePath);
        }
    }

    const structure = createTreeStructure(query, node);
    const summary = createSummaryString(query, node, stats);
    const content = node.content || '';

    return {
        summary,
        structure,
        content
    };
}
