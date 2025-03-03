export interface ParsedQuery {
    repository: string;
    ignorePatterns: Set<string>;
    includePatterns: Set<string>;
    maxFiles: number;
    maxTotalSizeBytes: number;
    maxDirectoryDepth: number;
}

export interface FileNode {
    name: string;
    path: string;
    size: number;
    content?: string;
    isDirectory: boolean;
    children?: FileNode[];
}

export interface IngestResult {
    summary: string;
    structure: string;
    content: string;
}

export interface FileStats {
    totalFiles: number;
    totalSize: number;
}

export interface NotebookCell {
    cell_type: 'code' | 'markdown' | string;
    source: string[] | string;
    metadata?: Record<string, unknown>;
}
