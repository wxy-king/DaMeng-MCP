# MCP服务器安全加固方案

## 一、SQL注入防护

### 方案1：参数化查询（推荐）
```typescript
// 使用参数化查询
async query(sql: string, params: any[] = [], allowAdvancedOperations: boolean = false) {
  const result = await this.connection.execute(sql, params);
}
```

### 方案2：SQL白名单验证
```typescript
// 只允许特定的SQL模式
const ALLOWED_PATTERNS = [
  /^SELECT\s+[\w\*,\s]+\s+FROM\s+[\w.]+(\s+WHERE\s+.+)?(\s+ORDER BY\s+.+)?(\s+LIMIT\s+\d+)?$/i
];
```

### 方案3：SQL解析验证
使用SQL解析器验证语法树，确保只有SELECT操作。

## 二、操作过滤加固

```typescript
// 更严格的SQL检测
function isDangerousSql(sql: string): boolean {
  const dangerousPatterns = [
    /;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)/i,
    /UNION\s+ALL\s+SELECT/i,
    /INTO\s+OUTFILE/i,
    /LOAD_FILE/i,
    /INFORMATION_SCHEMA/i,
    /EXEC\s*\(/i,
    /EXECUTE\s+IMMEDIATE/i,
    /SP_/i,  // 存储过程
    /XP_/i,  // 扩展存储过程
  ];

  return dangerousPatterns.some(pattern => pattern.test(sql));
}
```

## 三、敏感信息保护

### 3.1 日志脱敏
```typescript
function sanitizeSql(sql: string): string {
  // 移除可能的敏感数据
  return sql.replace(/'[^']*'/g, "'***'")
            .replace(/\b\d{11}\b/g, '***')  // 手机号
            .replace(/\b[\w.-]+@[\w.-]+\b/g, '***');  // 邮箱
}

console.log(`执行SQL: ${sanitizeSql(sql)}`);
```

### 3.2 结果集脱敏
```typescript
// 敏感字段自动脱敏
const SENSITIVE_COLUMNS = ['password', 'pwd', 'secret', 'token', 'key', 'id_card', 'phone'];

function maskSensitiveData(rows: any[], columns: string[]): any[] {
  return rows.map(row => {
    const masked = { ...row };
    columns.forEach((col, i) => {
      if (SENSITIVE_COLUMNS.some(s => col.toLowerCase().includes(s))) {
        masked[col] = '***';
      }
    });
    return masked;
  });
}
```

## 四、权限控制

### 4.1 数据库账户权限
```sql
-- 创建只读用户
CREATE USER mcp_readonly IDENTIFIED BY "secure_password";
GRANT SELECT ON schema.* TO mcp_readonly;

-- 创建读写用户（限制权限）
CREATE USER mcp_readwrite IDENTIFIED BY "secure_password";
GRANT SELECT, INSERT, UPDATE ON schema.table1 TO mcp_readwrite;
GRANT SELECT ON schema.table2 TO mcp_readwrite;  -- 只读
```

### 4.2 表级访问控制
```typescript
// 配置允许访问的表
const ALLOWED_TABLES = [
  'schedule_template',
  'schedule',
  // ...
];

function validateTableAccess(sql: string): boolean {
  const tables = extractTablesFromSql(sql);
  return tables.every(t => ALLOWED_TABLES.includes(t.toLowerCase()));
}
```

## 五、查询限制

### 5.1 结果集限制
```typescript
// 强制添加ROWNUM限制
function enforceLimit(sql: string, maxRows: number = 1000): string {
  if (!/ROWNUM\s*<=?\s*\d+/i.test(sql)) {
    return sql.replace(/;?\s*$/, ` WHERE ROWNUM <= ${maxRows}`);
  }
  return sql;
}
```

### 5.2 查询超时
```typescript
async queryWithTimeout(sql: string, timeoutMs: number = 30000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('查询超时')), timeoutMs)
  );

  return Promise.race([
    this.connection.execute(sql),
    timeoutPromise
  ]);
}
```

## 六、审计日志

```typescript
interface AuditLog {
  timestamp: Date;
  user: string;
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  sql: string;
  rowCount: number;
  duration: number;
  ip?: string;
}

async function logAudit(entry: AuditLog) {
  // 写入审计日志文件或数据库
  await appendFile('audit.log', JSON.stringify(entry) + '\n');
}
```

## 七、配置安全

### 7.1 环境变量加密
```typescript
// 使用加密存储密码
import { decrypt } from './crypto';

const password = process.env.DM_PASS_ENCRYPTED
  ? decrypt(process.env.DM_PASS_ENCRYPTED)
  : process.env.DM_PASS;
```

### 7.2 配置验证
```typescript
function validateConfig(config: DatabaseConfig): void {
  if (!config.host) throw new Error('数据库主机未配置');
  if (!config.password || config.password === 'SYSDBA') {
    console.warn('警告: 使用默认密码，请在生产环境中修改');
  }
  if (config.user === 'SYSDBA') {
    console.warn('警告: 使用SYSDBA账户，建议使用受限账户');
  }
}
```

## 八、推荐配置

### 最小安全配置
```json
{
  "mcpServers": {
    "dameng-database": {
      "env": {
        "DM_USER": "mcp_readonly",
        "DM_PASS": "secure_random_password",
        "USE_REAL_DB": "true",
        "MAX_RESULT_ROWS": "1000",
        "QUERY_TIMEOUT_MS": "30000",
        "AUDIT_ENABLED": "true"
      }
    }
  }
}
```

## 九、实施优先级

| 优先级 | 项目 | 工作量 | 影响 |
|--------|------|--------|------|
| P0 | 使用只读数据库账户 | 低 | 高 |
| P0 | SQL注入防护 | 中 | 高 |
| P1 | 结果集限制 | 低 | 中 |
| P1 | 查询超时 | 低 | 中 |
| P2 | 审计日志 | 中 | 中 |
| P2 | 日志脱敏 | 低 | 中 |
| P3 | 表级访问控制 | 中 | 低 |