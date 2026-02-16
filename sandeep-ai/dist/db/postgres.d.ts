import { Pool } from 'pg';
export declare const pool: Pool;
export declare function initDatabase(): Promise<void>;
export declare function query<T = any>(text: string, params?: any[]): Promise<T[]>;
export declare function queryOne<T = any>(text: string, params?: any[]): Promise<T | null>;
export declare function execute(text: string, params?: any[]): Promise<number>;
//# sourceMappingURL=postgres.d.ts.map