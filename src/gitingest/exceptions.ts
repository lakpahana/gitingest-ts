class InvalidPatternError extends Error {
    /**
    Exception raised when a pattern contains invalid characters.
    This exception is used to signal that a pattern provided for some operation
    contains characters that are not allowed. The valid characters for the pattern
    include alphanumeric characters, dash (-), underscore (_), dot (.), forward slash (/),
    plus (+), and asterisk (*).
    Parameters
    ----------
    pattern : str
        The invalid pattern that caused the error.
    */
    constructor(pattern: string) {
        super(`Pattern '${pattern}' contains invalid characters. Only alphanumeric characters, dash (-), underscore (_), dot (.), forward slash (/), plus (+), and asterisk (*) are allowed.`);
        this.name = 'InvalidPatternError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}

class AsyncTimeoutError extends Error {
    /**
    Exception raised when an async operation exceeds its timeout limit.
    This exception is used by the `async_timeout` decorator to signal that the wrapped
    asynchronous function has exceeded the specified time limit for execution.
    */
    constructor() {
        super('Asynchronous operation exceeded timeout limit.');
        this.name = 'AsyncTimeoutError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}


class MaxFilesReachedError extends Error {
    // Exception raised when the maximum number of files is reached.
    constructor(max_files: number) {
        super(`Maximum number of files (${max_files}) reached.`);
        this.name = 'MaxFilesReachedError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}

class MaxFileSizeReachedError extends Error {
    // Exception raised when the maximum file size is reached.
    constructor(max_size: number) {
        super(`Maximum file size limit (${(max_size / 1024 / 1024).toFixed(1)}MB) reached.`);
        this.name = 'MaxFileSizeReachedError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}


class AlreadyVisitedError extends Error {
    /**
     * Exception raised when a symlink target has already been visited.
     * This exception is used to signal that a symlink target has already been visited
     * during the traversal of a directory tree.
     * 
     * @param path The path of the symlink target that has already been visited.
     */
    constructor(path: string) {
        super(`Symlink target already visited: ${path}`);
        this.name = 'AlreadyVisitedError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}

class InvalidNotebookError extends Error {
    // Exception raised when a Jupyter notebook is invalid or cannot be processed.
    constructor(message: string) {
        super(message);
        this.name = 'InvalidNotebookError';
    }

    getErrorMessage(): string {
        return this.message;
    }
}

export {
    InvalidPatternError,
    AsyncTimeoutError,
    MaxFilesReachedError,
    MaxFileSizeReachedError,
    AlreadyVisitedError,
    InvalidNotebookError
};