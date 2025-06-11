declare module 'path' {
    export function join(...paths: string[]): string;
    export function dirname(path: string): string;
    export function extname(path: string): string;
} 