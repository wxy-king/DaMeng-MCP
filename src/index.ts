import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DatabaseConfig, MockDamengAdapter, RealDamengAdapter, DatabaseAdapter, QueryResult } from "./database/dameng-adapter";
import { z } from "zod";

// 简单的日志函数
function log(message: string) {
  console.error(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  // 从环境变量获取数据库配置
  const config: DatabaseConfig = {
    host: process.env.DM_HOST || "localhost",
    port: parseInt(process.env.DM_PORT || "5236", 10),
    user: process.env.DM_USER || "SYSDBA",
    password: process.env.DM_PASS || "SYSDBA",
    database: process.env.DM_DB || "SYSTEM"
  };

  log(`MCP Server 正在启动...`);
  log(`使用数据库配置: ${config.host}:${config.port}/${config.database}`);

  // 创建达梦数据库适配器实例
  const useRealAdapter = process.env.USE_REAL_DB === 'true';
  const db: DatabaseAdapter = useRealAdapter
    ? new RealDamengAdapter(config)
    : new MockDamengAdapter(config);

  try {
    await db.connect();
    log("成功连接到达梦数据库");
  } catch (error) {
    log(`数据库连接失败: ${(error as Error).message}`);
    process.exit(1);
  }

  // 创建MCP服务器
  const server = new McpServer({
    name: "dameng-database-mcp-server",
    version: "1.0.0",
  });

  // 注册工具 - 查询数据库 (使用 Zod schema)
  server.tool(
    "query_database",
    "查询达梦数据库，可执行SQL SELECT语句，默认情况下禁止执行INSERT/UPDATE/DELETE/DDL语句",
    {
      sql: z.string().describe("要执行的SQL查询语句"),
      allowAdvancedOperations: z.boolean().optional().default(false).describe("是否允许执行INSERT、UPDATE、DELETE和DDL语句（默认为false）")
    },
    async (args) => {
      try {
        log(`收到工具调用请求`);
        log(`完整参数对象: ${JSON.stringify(args, null, 2)}`);
        log(`参数类型: ${typeof args}`);
        log(`sql 参数: ${args?.sql}`);
        log(`sql 类型: ${typeof args?.sql}`);

        const { sql, allowAdvancedOperations } = args || {};
        log(`解构后 sql: ${sql}`);
        log(`解构后 allowAdvancedOperations: ${allowAdvancedOperations}`);

        if (!sql) {
          log(`错误: sql 参数为空或未定义`);
          return {
            content: [{
              type: "text" as const,
              text: "错误: sql 参数为空或未定义"
            }],
            isError: true
          };
        }

        log(`准备执行查询: ${sql}`);

        // 执行数据库查询
        const result: QueryResult = await db.query(sql, allowAdvancedOperations || false);

        log(`查询完成，返回 ${result.rows.length} 条记录`);

        const response: any = {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result.rows, null, 2)
          }]
        };

        if (result.warnings && result.warnings.length > 0) {
          response.content.push({
            type: "text" as const,
            text: `\n警告: ${result.warnings.join('; ')}`
          });
        }

        return response;
      } catch (error) {
        log(`工具执行错误: ${(error as Error).message}`);

        return {
          content: [{
            type: "text" as const,
            text: `错误: ${(error as Error).message}`
          }],
          isError: true
        };
      }
    }
  );

  // 启动服务器
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("MCP服务器已启动，监听stdio");

  // 监听退出信号
  process.on("SIGINT", async () => {
    log("接收到SIGINT，正在关闭服务器...");
    await db.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log("接收到SIGTERM，正在关闭服务器...");
    await db.disconnect();
    process.exit(0);
  });
}

// 启动应用程序
main().catch(error => {
  log(`应用启动失败: ${(error as Error).message}`);
  process.exit(1);
});