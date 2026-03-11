/**
 * 达梦数据库适配器接口
 * 提供统一的数据库操作接口，便于集成真实的达梦数据库驱动
 */
import { SecurityConfig } from './sql-security';
export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
export interface QueryResult {
    rows: any[];
    rowCount?: number;
    columns?: string[];
    warnings?: string[];
}
export interface DatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, allowAdvancedOperations?: boolean): Promise<QueryResult>;
}
export declare class MockDamengAdapter implements DatabaseAdapter {
    private config;
    private securityConfig;
    constructor(config: DatabaseConfig, securityConfig?: Partial<SecurityConfig>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, allowAdvancedOperations?: boolean): Promise<QueryResult>;
}
/**
 * 真实达梦数据库适配器的实现
 * 使用 dmdb 驱动包与达梦数据库交互
 */
export declare class RealDamengAdapter implements DatabaseAdapter {
    private config;
    private securityConfig;
    private pool;
    private connection;
    constructor(config: DatabaseConfig, securityConfig?: Partial<SecurityConfig>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, allowAdvancedOperations?: boolean): Promise<QueryResult>;
}
