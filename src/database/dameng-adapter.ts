/**
 * 达梦数据库适配器接口
 * 提供统一的数据库操作接口，便于集成真实的达梦数据库驱动
 */

import {
  detectSqlInjection,
  validateOperation,
  enforceResultLimit,
  withTimeout,
  sanitizeSqlForLog,
  validateTableAccess,
  DEFAULT_SECURITY_CONFIG,
  SecurityConfig
} from './sql-security';

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

/**
 * 基础安全检查方法
 */
function performSecurityChecks(
  sql: string,
  allowAdvancedOperations: boolean,
  securityConfig: SecurityConfig
): { sql: string; warnings: string[] } {
  const warnings: string[] = [];

  // 1. SQL注入检测
  const injectionCheck = detectSqlInjection(sql);
  if (!injectionCheck.isSafe) {
    throw new Error(`SQL安全检查失败: ${injectionCheck.threats.join('; ')}`);
  }
  warnings.push(...injectionCheck.warnings);

  // 2. 操作类型验证
  const operationCheck = validateOperation(sql, allowAdvancedOperations);
  if (!operationCheck.isValid) {
    throw new Error(operationCheck.error || '操作不被允许');
  }

  // 3. 表访问权限验证
  const tableCheck = validateTableAccess(
    sql,
    securityConfig.allowedTables,
    securityConfig.blockedTables
  );
  if (!tableCheck.isValid) {
    throw new Error(tableCheck.error || '表访问权限不足');
  }

  // 4. 结果集限制
  let processedSql = sql;
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    processedSql = enforceResultLimit(sql, securityConfig.maxResultRows);
    if (processedSql !== sql) {
      warnings.push(`已自动添加结果集限制 (最大${securityConfig.maxResultRows}行)`);
    }
  }

  return { sql: processedSql, warnings };
}

// 当前使用模拟适配器，在实际部署时应替换为真实达梦驱动的实现
export class MockDamengAdapter implements DatabaseAdapter {
  private config: DatabaseConfig;
  private securityConfig: SecurityConfig;

  constructor(config: DatabaseConfig, securityConfig?: Partial<SecurityConfig>) {
    this.config = config;
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...securityConfig };
  }

  async connect(): Promise<void> {
    console.log(`[MockDamengAdapter] 连接到达梦数据库: ${this.config.host}:${this.config.port}/${this.config.database}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async disconnect(): Promise<void> {
    console.log('[MockDamengAdapter] 断开数据库连接');
  }

  async query(sql: string, allowAdvancedOperations: boolean = false): Promise<QueryResult> {
    // 执行安全检查
    const { sql: processedSql, warnings } = performSecurityChecks(
      sql,
      allowAdvancedOperations,
      this.securityConfig
    );

    console.log(`[MockDamengAdapter] 执行SQL: ${sanitizeSqlForLog(processedSql)}`);
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

/**
 * 真实达梦数据库适配器的实现
 * 使用 dmdb 驱动包与达梦数据库交互
 */
export class RealDamengAdapter implements DatabaseAdapter {
  private config: DatabaseConfig;
  private securityConfig: SecurityConfig;
  private pool: any;
  private connection: any;

  constructor(config: DatabaseConfig, securityConfig?: Partial<SecurityConfig>) {
    this.config = config;
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...securityConfig };
  }

  async connect(): Promise<void> {
    console.log(`[RealDamengAdapter] 连接到达梦数据库: ${this.config.host}:${this.config.port}/${this.config.database}`);

    let dmdb: any;
    try {
      const dmdbModule = await import('dmdb');
      // 处理 CommonJS 模块的默认导出
      dmdb = dmdbModule.default || dmdbModule;
    } catch (error) {
      throw new Error(
        '未找到达梦数据库驱动。请安装达梦数据库Node.js驱动: npm install dmdb。错误: ' +
        (error as Error).message
      );
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
    } catch (error) {
      throw new Error(`达梦数据库连接失败: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    console.log('[RealDamengAdapter] 断开数据库连接');
    try {
      if (this.connection) {
        await this.connection.close();
      }
      if (this.pool) {
        await this.pool.close();
      }
      console.log('[RealDamengAdapter] 数据库连接已断开');
    } catch (error) {
      console.error('[RealDamengAdapter] 关闭数据库连接时出错:', (error as Error).message);
    }
  }

  async query(sql: string, allowAdvancedOperations: boolean = false): Promise<QueryResult> {
    // 执行安全检查
    const { sql: processedSql, warnings } = performSecurityChecks(
      sql,
      allowAdvancedOperations,
      this.securityConfig
    );

    // 记录脱敏后的SQL
    console.log(`[RealDamengAdapter] 执行SQL: ${sanitizeSqlForLog(processedSql)}`);

    if (!this.connection) {
      throw new Error('数据库未连接，请先调用connect()方法');
    }

    try {
      // 使用超时包装查询
      const executePromise = this.connection.execute(processedSql);
      const result = await withTimeout(
        executePromise,
        this.securityConfig.queryTimeoutMs,
        '数据库查询超时'
      );

      // 处理查询结果
      const rows = result.rows || [];
      const actualRowCount = rows.length;

      // 检查结果集大小
      if (actualRowCount > this.securityConfig.maxResultRows) {
        warnings.push(`结果集已截断: 返回${this.securityConfig.maxResultRows}行，共${actualRowCount}行`);
      }

      const queryResult: QueryResult = {
        rows: rows.slice(0, this.securityConfig.maxResultRows),
        rowCount: actualRowCount,
        columns: result.metaData ? result.metaData.map((col: any) => col.name) : [],
        warnings: warnings.length > 0 ? warnings : undefined
      };

      // 对于非查询操作，提交事务
      const normalizedSql = processedSql.trim().toUpperCase();
      if (!normalizedSql.startsWith('SELECT')) {
        await this.connection.execute("commit;");
      }

      return queryResult;
    } catch (error) {
      // 错误信息脱敏
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('password') || errorMessage.includes(this.config.password)) {
        throw new Error('数据库查询失败: 连接认证错误');
      }
      throw new Error(`数据库查询失败: ${errorMessage}`);
    }
  }
}