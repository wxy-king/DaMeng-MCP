/**
 * SQL安全验证模块
 * 提供SQL注入检测、查询限制等安全功能
 */
export interface SecurityCheckResult {
    isSafe: boolean;
    threats: string[];
    warnings: string[];
}
export interface SecurityConfig {
    maxResultRows: number;
    queryTimeoutMs: number;
    enableStrictMode: boolean;
    allowedTables?: string[];
    blockedTables?: string[];
}
export declare const DEFAULT_SECURITY_CONFIG: SecurityConfig;
/**
 * 检测SQL注入威胁
 */
export declare function detectSqlInjection(sql: string): SecurityCheckResult;
/**
 * 验证操作类型
 */
export declare function validateOperation(sql: string, allowAdvancedOperations: boolean): {
    isValid: boolean;
    error?: string;
};
/**
 * 强制添加结果集限制
 */
export declare function enforceResultLimit(sql: string, maxRows: number): string;
/**
 * 创建带超时的Promise
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>;
/**
 * 脱敏SQL日志（移除敏感数据）
 */
export declare function sanitizeSqlForLog(sql: string): string;
/**
 * 验证表访问权限
 */
export declare function validateTableAccess(sql: string, allowedTables?: string[], blockedTables?: string[]): {
    isValid: boolean;
    error?: string;
};
