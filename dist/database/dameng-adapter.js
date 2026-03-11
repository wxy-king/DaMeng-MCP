"use strict";
/**
 * 达梦数据库适配器接口
 * 提供统一的数据库操作接口，便于集成真实的达梦数据库驱动
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealDamengAdapter = exports.MockDamengAdapter = void 0;
const sql_security_1 = require("./sql-security");
/**
 * 基础安全检查方法
 */
function performSecurityChecks(sql, allowAdvancedOperations, securityConfig) {
    const warnings = [];
    // 1. SQL注入检测
    const injectionCheck = (0, sql_security_1.detectSqlInjection)(sql);
    if (!injectionCheck.isSafe) {
        throw new Error(`SQL安全检查失败: ${injectionCheck.threats.join('; ')}`);
    }
    warnings.push(...injectionCheck.warnings);
    // 2. 操作类型验证
    const operationCheck = (0, sql_security_1.validateOperation)(sql, allowAdvancedOperations);
    if (!operationCheck.isValid) {
        throw new Error(operationCheck.error || '操作不被允许');
    }
    // 3. 表访问权限验证
    const tableCheck = (0, sql_security_1.validateTableAccess)(sql, securityConfig.allowedTables, securityConfig.blockedTables);
    if (!tableCheck.isValid) {
        throw new Error(tableCheck.error || '表访问权限不足');
    }
    // 4. 结果集限制
    let processedSql = sql;
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
        processedSql = (0, sql_security_1.enforceResultLimit)(sql, securityConfig.maxResultRows);
        if (processedSql !== sql) {
            warnings.push(`已自动添加结果集限制 (最大${securityConfig.maxResultRows}行)`);
        }
    }
    return { sql: processedSql, warnings };
}
// 当前使用模拟适配器，在实际部署时应替换为真实达梦驱动的实现
class MockDamengAdapter {
    config;
    securityConfig;
    constructor(config, securityConfig) {
        this.config = config;
        this.securityConfig = { ...sql_security_1.DEFAULT_SECURITY_CONFIG, ...securityConfig };
    }
    async connect() {
        console.log(`[MockDamengAdapter] 连接到达梦数据库: ${this.config.host}:${this.config.port}/${this.config.database}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    async disconnect() {
        console.log('[MockDamengAdapter] 断开数据库连接');
    }
    async query(sql, allowAdvancedOperations = false) {
        // 执行安全检查
        const { sql: processedSql, warnings } = performSecurityChecks(sql, allowAdvancedOperations, this.securityConfig);
        console.log(`[MockDamengAdapter] 执行SQL: ${(0, sql_security_1.sanitizeSqlForLog)(processedSql)}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
            rows: [
                { id: 1, name: "模拟数据1", description: "这是一个模拟的查询结果" },
                { id: 2, name: "模拟数据2", description: "这是另一个模拟的查询结果" }
            ],
            rowCount: 2,
            columns: ["id", "name", "description"],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
}
exports.MockDamengAdapter = MockDamengAdapter;
/**
 * 真实达梦数据库适配器的实现
 * 使用 dmdb 驱动包与达梦数据库交互
 */
class RealDamengAdapter {
    config;
    securityConfig;
    pool;
    connection;
    constructor(config, securityConfig) {
        this.config = config;
        this.securityConfig = { ...sql_security_1.DEFAULT_SECURITY_CONFIG, ...securityConfig };
    }
    async connect() {
        console.log(`[RealDamengAdapter] 连接到达梦数据库: ${this.config.host}:${this.config.port}/${this.config.database}`);
        let dmdb;
        try {
            const dmdbModule = await Promise.resolve().then(() => __importStar(require('dmdb')));
            // 处理 CommonJS 模块的默认导出
            dmdb = dmdbModule.default || dmdbModule;
        }
        catch (error) {
            throw new Error('未找到达梦数据库驱动。请安装达梦数据库Node.js驱动: npm install dmdb。错误: ' +
                error.message);
        }
        const connectString = `dm://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}`;
        try {
            this.pool = await dmdb.createPool({
                connectString: connectString,
                poolMax: 10,
                poolMin: 1,
                autoCommit: false
            });
            this.connection = await this.pool.getConnection();
            console.log('[RealDamengAdapter] 成功连接到达梦数据库');
        }
        catch (error) {
            throw new Error(`达梦数据库连接失败: ${error.message}`);
        }
    }
    async disconnect() {
        console.log('[RealDamengAdapter] 断开数据库连接');
        try {
            if (this.connection) {
                await this.connection.close();
            }
            if (this.pool) {
                await this.pool.close();
            }
            console.log('[RealDamengAdapter] 数据库连接已断开');
        }
        catch (error) {
            console.error('[RealDamengAdapter] 关闭数据库连接时出错:', error.message);
        }
    }
    async query(sql, allowAdvancedOperations = false) {
        // 执行安全检查
        const { sql: processedSql, warnings } = performSecurityChecks(sql, allowAdvancedOperations, this.securityConfig);
        // 记录脱敏后的SQL
        console.log(`[RealDamengAdapter] 执行SQL: ${(0, sql_security_1.sanitizeSqlForLog)(processedSql)}`);
        if (!this.connection) {
            throw new Error('数据库未连接，请先调用connect()方法');
        }
        try {
            // 使用超时包装查询
            const executePromise = this.connection.execute(processedSql);
            const result = await (0, sql_security_1.withTimeout)(executePromise, this.securityConfig.queryTimeoutMs, '数据库查询超时');
            // 处理查询结果
            const rows = result.rows || [];
            const actualRowCount = rows.length;
            // 检查结果集大小
            if (actualRowCount > this.securityConfig.maxResultRows) {
                warnings.push(`结果集已截断: 返回${this.securityConfig.maxResultRows}行，共${actualRowCount}行`);
            }
            const queryResult = {
                rows: rows.slice(0, this.securityConfig.maxResultRows),
                rowCount: actualRowCount,
                columns: result.metaData ? result.metaData.map((col) => col.name) : [],
                warnings: warnings.length > 0 ? warnings : undefined
            };
            // 对于非查询操作，提交事务
            const normalizedSql = processedSql.trim().toUpperCase();
            if (!normalizedSql.startsWith('SELECT')) {
                await this.connection.execute("commit;");
            }
            return queryResult;
        }
        catch (error) {
            // 错误信息脱敏
            const errorMessage = error.message;
            if (errorMessage.includes('password') || errorMessage.includes(this.config.password)) {
                throw new Error('数据库查询失败: 连接认证错误');
            }
            throw new Error(`数据库查询失败: ${errorMessage}`);
        }
    }
}
exports.RealDamengAdapter = RealDamengAdapter;
//# sourceMappingURL=dameng-adapter.js.map