import { ParsedQuery } from './types';
import { DEFAULT_IGNORE_PATTERNS } from './ignore_patterns';
import { MAX_FILES, MAX_TOTAL_SIZE_BYTES, MAX_DIRECTORY_DEPTH } from './confg';
import { InvalidPatternError } from './exceptions';

export function parseQuery(repository: string, ignorePatterns?: string[], includePatterns?: string[]): ParsedQuery {
    // Validate repository path
    if (!repository) {
        throw new Error('Repository path cannot be empty');
    }

    // Initialize patterns
    const finalIgnorePatterns = new Set<string>(DEFAULT_IGNORE_PATTERNS);
    const finalIncludePatterns = new Set<string>();

    // Add custom ignore patterns if provided
    if (ignorePatterns) {
        for (const pattern of ignorePatterns) {
            validatePattern(pattern);
            finalIgnorePatterns.add(pattern);
        }
    }

    // Add custom include patterns if provided
    if (includePatterns) {
        for (const pattern of includePatterns) {
            validatePattern(pattern);
            finalIncludePatterns.add(pattern);
        }
    }

    return {
        repository,
        ignorePatterns: finalIgnorePatterns,
        includePatterns: finalIncludePatterns,
        maxFiles: MAX_FILES,
        maxTotalSizeBytes: MAX_TOTAL_SIZE_BYTES,
        maxDirectoryDepth: MAX_DIRECTORY_DEPTH
    };
}

function validatePattern(pattern: string): void {
    const validPattern = /^[a-zA-Z0-9\-_./+*]+$/;
    if (!validPattern.test(pattern)) {
        throw new InvalidPatternError(pattern);
    }
}
