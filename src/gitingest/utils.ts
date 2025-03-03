export function fnmatch(name: string, pattern: string): boolean {
    const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*/g, '.*')                  // Convert * to .*
        .replace(/\?/g, '.');                  // Convert ? to .
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
}

export function formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat().format(num);
}