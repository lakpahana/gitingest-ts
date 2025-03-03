#!/usr/bin/env node

import { Command } from 'commander';
import { MAX_FILE_SIZE, OUTPUT_FILE_PATH } from './confg';
import { ingest } from './repository_ingest';
import { formatSize } from './utils';

const program = new Command();

interface CliOptions {
    output?: string;
    maxSize?: string;
    excludePattern?: string[];
    includePattern?: string[];
    branch?: string;
}

async function main() {
    program
        .name('gitingest')
        .description('Analyze and ingest git repositories or local directories')
        .argument('[source]', 'Source directory or repository URL', '.')
        .option('-o, --output <path>', 'Output file path')
        .option('-s, --max-size <size>', 'Maximum file size to process (e.g., "10MB")', String(MAX_FILE_SIZE))
        .option('-e, --exclude-pattern <pattern...>', 'Patterns to exclude')
        .option('-i, --include-pattern <pattern...>', 'Patterns to include')
        .option('-b, --branch <branch>', 'Branch to clone')
        .version(process.env.npm_package_version || '1.0.0');

    program.parse();

    const source = program.args[0];
    const options = program.opts<CliOptions>();

    try {
        // Parse max size
        let maxSize = MAX_FILE_SIZE;
        if (options.maxSize) {
            const sizeMatch = options.maxSize.match(/^(\d+)(B|KB|MB|GB|TB)?$/i);
            if (sizeMatch) {
                const [, size, unit = 'B'] = sizeMatch;
                const multipliers: { [key: string]: number } = {
                    'B': 1,
                    'KB': 1024,
                    'MB': 1024 * 1024,
                    'GB': 1024 * 1024 * 1024,
                    'TB': 1024 * 1024 * 1024 * 1024
                };
                maxSize = parseInt(size) * multipliers[unit.toUpperCase()];
            } else {
                console.error('Invalid size format. Use format like "10MB"');
                process.exit(1);
            }
        }

        // Prepare options for ingest
        const ingestOptions = {
            ignorePatterns: options.excludePattern,
            includePatterns: options.includePattern,
            branch: options.branch,
            maxSize
        };

        // Determine output path
        const outputPath = options.output || OUTPUT_FILE_PATH;

        // Run ingestion
        const result = await ingest(source, ingestOptions);

        // Write output to file
        const fs = require('fs').promises;
        await fs.writeFile(
            outputPath,
            `${result.summary}\n\n${result.structure}\n\n${result.content}`
        );

        console.log(`Analysis complete! Output written to: ${outputPath}`);
        console.log('\nSummary:');
        console.log(result.summary);

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

// Only run if this file is being executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
