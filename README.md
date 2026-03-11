# 达梦数据库 MCP Server

这是一个用于连接达梦（Dameng）数据库的 Model Context Protocol (MCP) 服务器，提供了安全的数据库查询功能。

## 功能特性

- 安全的数据库查询工具，支持 SQL SELECT 语句
- 可选的安全策略：默认仅允许只读操作（SELECT），通过参数可启用高级操作（INSERT、UPDATE、DELETE、DDL）
- 基于环境变量的配置管理
- 完整的错误处理和日志记录

## 安装要求

- Node.js 18 或更高版本
- 达梦数据库服务器访问权限
- `@modelcontextprotocol/sdk` 包
- 达梦数据库 Node.js 驱动 (如 dmhs)

要安装达梦数据库驱动，可以选择以下方式之一：

### 自动安装
```bash
# 运行安装脚本（Windows）
npm run install-driver
# 或直接运行批处理文件
./install.bat

# 运行安装脚本（Linux/Mac）
./install.sh
```

### 手动安装
```bash
# 根据实际可用的达梦驱动包名选择其中一个
npm install dmhs
# 或者
npm install @dameng/dm
# 或者
npm install node-dm
```

### 驱动包说明
目前达梦数据库可能提供以下几种Node.js驱动包：
- `dmhs` - 达梦官方提供的高性能驱动
- `@dameng/dm` - 达梦官方npm包
- `node-dm` - 社区维护的达梦驱动

请参考达梦官方文档获取最新的驱动包名称和安装说明。

## 快速开始

1. 安装依赖：
   ```bash
   npm install
   ```

2. 配置数据库连接信息：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件并填入正确的数据库连接信息
   ```

3. 启动 MCP 服务器：
   ```bash
   npm run dev  # 开发模式（带监听）
   # 或
   npm start    # 生产模式
   ```

## 配置

编辑 `.env` 文件配置数据库连接：

```env
DM_HOST=localhost          # 数据库主机地址
DM_PORT=5236               # 数据库端口（达梦默认为5236）
DM_USER=SYSDBA             # 数据库用户名
DM_PASS=SYSDBA             # 数据库密码
DM_DB=SYSTEM               # 要连接的数据库名
```

claude配置参考
"D:/my-mcp-server": {
      "allowedTools": [],
      "mcpContextUris": [],
      "mcpServers": {
        "dameng-database": {
          "type": "stdio",
          "command": "D:\\nodejs\\node.exe",
          "args": [
            "D:\\my-mcp-server\\dist\\index.js"
          ],
          "env": {
            "DM_HOST": "dbahost",
            "DM_PORT": "port",
            "DM_USER": "your account",
            "DM_PASS": "your password",
            "DM_DB": "schema",
            "USE_REAL_DB": "true",
            "MAX_RESULT_ROWS": "1000",
            "QUERY_TIMEOUT_MS": "30000",
            "allowAdvancedOperations": true
          }
        }
      },
      "enabledMcpjsonServers": [],
      "disabledMcpjsonServers": [],
      "hasTrustDialogAccepted": true,
      "projectOnboardingSeenCount": 0,
      "hasClaudeMdExternalIncludesApproved": false,
      "hasClaudeMdExternalIncludesWarningShown": false,
      "reactVulnerabilityCache": {
        "detected": false,
        "package": null,
        "packageName": null,
        "version": null,
        "packageManager": null
      },
      "hasCompletedProjectOnboarding": true
    }

## 工具说明

### query_database

执行 SQL 查询的工具。

参数：
- `sql`: (必需) 要执行的 SQL 查询语句
- `allowAdvancedOperations`: (可选) 是否允许执行 INSERT、UPDATE、DELETE 和 DDL 语句，默认为 false

示例调用：
```json
{
  "name": "query_database",
  "arguments": {
    "sql": "SELECT * FROM users WHERE id = 1"
  }
}
```

启用高级操作的示例：
```json
{
  "name": "query_database",
  "arguments": {
    "sql": "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')",
    "allowAdvancedOperations": true
  }
}
```

## 安全说明

- 默认情况下，服务器只允许执行 SELECT 查询，防止意外的数据修改
- 需要显式设置 `allowAdvancedOperations: true` 才能执行可能修改数据的操作
- 所有数据库凭证应通过环境变量提供，不应硬编码在代码中

## 构建

要构建项目：

```bash
npm run build
```

这会将 TypeScript 代码编译为 JavaScript 并输出到 `dist` 目录。

## 注意事项

此项目包含一个灵活的数据库适配器架构 (`src/database/dameng-adapter.ts`)，目前提供了一个模拟实现用于演示目的。在生产环境中使用前，您需要：

1. 安装真实的达梦数据库 Node.js 驱动
2. 实现 `DatabaseAdapter` 接口的真实版本，替换 `RealDamengAdapter` 类中的占位符代码
3. 在 `src/index.ts` 中使用真实适配器替代模拟适配器：

   ```typescript
   // 将这行：
   const db: DatabaseAdapter = new MockDamengAdapter(config);

   // 替换为：
   const db: DatabaseAdapter = new RealDamengAdapter(config);
   ```

4. 测试与真实达梦数据库的兼容性