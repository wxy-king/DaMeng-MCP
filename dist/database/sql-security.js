"use strict";
/**
 * SQL安全验证模块
 * 提供SQL注入检测、查询限制等安全功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECURITY_CONFIG = void 0;
exports.detectSqlInjection = detectSqlInjection;
exports.validateOperation = validateOperation;
exports.enforceResultLimit = enforceResultLimit;
exports.withTimeout = withTimeout;
exports.sanitizeSqlForLog = sanitizeSqlForLog;
exports.validateTableAccess = validateTableAccess;
// 危险SQL模式 - 用于检测潜在的SQL注入攻击
const DANGEROUS_PATTERNS = [
    // 多语句注入
    { pattern: /;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)/i, description: '多语句注入' },
    // UNION注入
    { pattern: /UNION\s+(ALL\s+)?SELECT/i, description: 'UNION注入' },
    // 文件操作
    { pattern: /INTO\s+(OUT|DUMP)FILE/i, description: '文件写入操作' },
    { pattern: /LOAD_FILE\s*\(/i, description: '文件读取操作' },
    // 系统信息访问
    { pattern: /INFORMATION_SCHEMA/i, description: '系统信息访问' },
    { pattern: /SYS\.(USER|TABLE|COLUMN|VIEW)/i, description: '系统表访问' },
    // 动态SQL执行
    { pattern: /EXEC(UTE)?\s*\(/i, description: '动态SQL执行' },
    { pattern: /EXECUTE\s+IMMEDIATE/i, description: '立即执行语句' },
    { pattern: /SP_/i, description: '存储过程调用' },
    { pattern: /XP_/i, description: '扩展存储过程' },
    // 注释绕过
    { pattern: /\/\*.*\*\//, description: 'SQL注释' },
    { pattern: /--.*$/, description: '行注释' },
    // 布尔盲注特征
    { pattern: /'\s*(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i, description: '布尔注入' },
    { pattern: /"\s*(OR|AND)\s+"?\d+"?\s*=\s+"?\d+/i, description: '布尔注入' },
    // 时间盲注特征
    { pattern: /SLEEP\s*\(/i, description: '时间盲注' },
    { pattern: /WAITFOR\s+DELAY/i, description: '时间盲注' },
    { pattern: /PG_SLEEP/i, description: '时间盲注' },
    // 危险函数
    { pattern: /BENCHMARK\s*\(/i, description: '性能测试函数' },
    { pattern: /LOAD_EXTENSION/i, description: '扩展加载' },
    // 特殊字符组合
    { pattern: /'\s*;\s*--/, description: '注入终止符' },
    { pattern: /1\s*=\s*1/, description: '永真条件' },
    { pattern: /'\s*=\s*'/, description: '字符串比较注入' },
];
// 敏感表名模式
const SENSITIVE_TABLE_PATTERNS = [
    /user$/i,
    /password$/i,
    /secret$/i,
    /token$/i,
    /key$/i,
    /credential$/i,
    /session$/i,
    /auth$/i,
    /permission$/i,
    /role$/i,
];
// 默认安全配置
exports.DEFAULT_SECURITY_CONFIG = {
    maxResultRows: parseInt(process.env.MAX_RESULT_ROWS || '1000', 10),
    queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10),
    enableStrictMode: process.env.SQL_STRICT_MODE === 'true',
};
/**
 * 检测SQL注入威胁
 */
function detectSqlInjection(sql) {
    const threats = [];
    const warnings = [];
    // 检测危险模式
    for (const { pattern, description } of DANGEROUS_PATTERNS) {
        if (pattern.test(sql)) {
            threats.push(`检测到潜在威胁: ${description}`);
        }
    }
    // 检测敏感表访问
    const tableMatches = sql.match(/(?:FROM|JOIN|INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (tableMatches) {
        for (const match of tableMatches) {
            const tableName = match.split(/\s+/)[1];
            for (const sensitivePattern of SENSITIVE_TABLE_PATTERNS) {
                if (sensitivePattern.test(tableName)) {
                    warnings.push(`访问敏感表: ${tableName}`);
                }
            }
        }
    }
    // 检测无WHERE条件的UPDATE/DELETE（在允许高级操作时）
    const normalizedSql = sql.trim().toUpperCase();
    if ((normalizedSql.startsWith('UPDATE') || normalizedSql.startsWith('DELETE'))) {
        if (!normalizedSql.includes('WHERE')) {
            warnings.push('UPDATE/DELETE操作缺少WHERE条件，可能影响全表');
        }
    }
    // 检测SELECT *
    if (normalizedSql.includes('SELECT *') || normalizedSql.includes('SELECT  *')) {
        warnings.push('使用SELECT *可能返回过多数据');
    }
    return {
        isSafe: threats.length === 0,
        threats,
        warnings,
    };
}
/**
 * 验证操作类型
 */
function validateOperation(sql, allowAdvancedOperations) {
    const normalizedSql = sql.trim().toUpperCase();
    // 定义危险操作关键字
    const dangerousOperations = [
        'INSERT', 'UPDATE', 'DELETE',
        'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
        'GRANT', 'REVOKE', 'MERGE'
    ];
    // 检查是否以危险操作开头
    const startsWithDangerous = dangerousOperations.some(op => normalizedSql.startsWith(op));
    // 检查是否包含危险操作（通过分号、注释等绕过的情况）
    const containsDangerous = dangerousOperations.some(op => normalizedSql.includes(op));
    if (!allowAdvancedOperations) {
        // 只允许SELECT、WITH (CTE)、EXPLAIN等只读操作
        const readOnlyPrefixes = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESC', 'DESCRIBE'];
        const isReadOnly = readOnlyPrefixes.some(prefix => normalizedSql.startsWith(prefix));
        if (!isReadOnly || containsDangerous) {
            return {
                isValid: false,
                error: '默认情况下只允许执行SELECT查询。如需执行修改操作，请设置allowAdvancedOperations参数为true。'
            };
        }
    }
    else {
        // 允许高级操作时，仍然检查是否有危险模式
        if (startsWithDangerous) {
            // 检查是否有WHERE条件
            if ((normalizedSql.startsWith('UPDATE') || normalizedSql.startsWith('DELETE')) &&
                !normalizedSql.includes('WHERE')) {
                return {
                    isValid: false,
                    error: 'UPDATE/DELETE操作必须包含WHERE条件以防止误操作全表。'
                };
            }
        }
    }
    return { isValid: true };
}
/**
 * 强制添加结果集限制
 */
function enforceResultLimit(sql, maxRows) {
    const normalizedSql = sql.trim().toUpperCase();
    // 只对SELECT语句添加限制
    if (!normalizedSql.startsWith('SELECT')) {
        return sql;
    }
    // 检查是否已有ROWNUM限制
    if (/ROWNUM\s*<=?\s*\d+/i.test(sql)) {
        // 提取现有的ROWNUM值
        const match = sql.match(/ROWNUM\s*<=?\s*(\d+)/i);
        if (match) {
            const currentLimit = parseInt(match[1], 10);
            if (currentLimit > maxRows) {
                // 替换为更小的限制
                return sql.replace(/ROWNUM\s*<=?\s*\d+/i, `ROWNUM <= ${maxRows}`);
            }
        }
        return sql;
    }
    // 添加ROWNUM限制
    // 需要处理已有WHERE子句的情况
    const cleanSql = sql.trim().replace(/;+$/, ''); // 移除末尾分号
    if (normalizedSql.includes(' WHERE ')) {
        return `${cleanSql} AND ROWNUM <= ${maxRows}`;
    }
    else {
        return `${cleanSql} WHERE ROWNUM <= ${maxRows}`;
    }
}
/**
 * 创建带超时的Promise
 */
function withTimeout(promise, timeoutMs, errorMessage = '查询超时') {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${errorMessage} (超时时间: ${timeoutMs}ms)`));
        }, timeoutMs);
        promise
            .then((result) => {
            clearTimeout(timer);
            resolve(result);
        })
            .catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
/**
 * 脱敏SQL日志（移除敏感数据）
 */
function sanitizeSqlForLog(sql) {
    let sanitized = sql;
    // 移除字符串字面量中的内容
    sanitized = sanitized.replace(/'[^']*'/g, "'***'");
    // 移除可能的手机号
    sanitized = sanitized.replace(/\b1[3-9]\d{9}\b/g, '***phone***');
    // 移除可能的邮箱
    sanitized = sanitized.replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '***email***');
    // 移除可能的身份证号
    sanitized = sanitized.replace(/\b\d{17}[\dXx]\b/g, '***idcard***');
    // 限制长度
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500) + '...[truncated]';
    }
    return sanitized;
}
/**
 * 验证表访问权限
 */
function validateTableAccess(sql, allowedTables, blockedTables) {
    // 提取SQL中的表名
    const tableMatches = sql.match(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi);
    if (!tableMatches) {
        return { isValid: true };
    }
    const tables = tableMatches.map(match => {
        const parts = match.split(/\s+/);
        return parts[1].toLowerCase();
    });
    // 检查黑名单
    if (blockedTables && blockedTables.length > 0) {
        const blockedFound = tables.filter(t => blockedTables.some(blocked => t.includes(blocked.toLowerCase())));
        if (blockedFound.length > 0) {
            return {
                isValid: false,
                error: `禁止访问的表: ${blockedFound.join(', ')}`
            };
        }
    }
    // 检查白名单
    if (allowedTables && allowedTables.length > 0) {
        const notAllowed = tables.filter(t => !allowedTables.some(allowed => t.includes(allowed.toLowerCase())));
        if (notAllowed.length > 0) {
            return {
                isValid: false,
                error: `未授权访问的表: ${notAllowed.join(', ')}`
            };
        }
    }
    return { isValid: true };
}
//# sourceMappingURL=sql-security.js.map