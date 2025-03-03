import * as fs from 'fs/promises';
import { NotebookCell } from './types';
import { InvalidNotebookError } from './exceptions';

export async function processNotebook(filePath: string): Promise<string> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const notebook = JSON.parse(content);

        if (!notebook.cells || !Array.isArray(notebook.cells)) {
            throw new InvalidNotebookError('Invalid notebook format: missing or invalid cells array');
        }

        const cells = notebook.cells as NotebookCell[];
        const processedCells: string[] = [];

        for (const cell of cells) {
            if (cell.cell_type === 'code' || cell.cell_type === 'markdown') {
                if (Array.isArray(cell.source)) {
                    const cellContent = cell.source.join('');
                    const trimmedContent = cellContent.trim();
                    if (trimmedContent) {
                        processedCells.push(`[${cell.cell_type}]\n${trimmedContent}`);
                    }
                } else if (typeof cell.source === 'string') {
                    const trimmedContent = cell.source.trim();
                    if (trimmedContent) {
                        processedCells.push(`[${cell.cell_type}]\n${trimmedContent}`);
                    }
                }
            }
        }

        return processedCells.join('\n\n');
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new InvalidNotebookError('Invalid JSON in notebook file');
        }
        throw error;
    }
}
