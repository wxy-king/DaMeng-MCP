"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const dameng_adapter_1 = require("./database/dameng-adapter");
const zod_1 = require("zod");
// 简单的日志函数
function log(message) {
    console.error(`[${new Date().toISOString()}] ${message}`);
}
async function main() {
    // 从环境变量获取数据库配置
    const config = {
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
    const db = useRealAdapter
        ? new dameng_adapter_1.RealDamengAdapter(config)
        : new dameng_adapter_1.MockDamengAdapter(config);
    try {
        await db.connect();
        log("成功连接到达梦数据库");
    }
    catch (error) {
        log(`数据库连接失败: ${error.message}`);
        process.exit(1);
    }
    // 创建MCP服务器
    const server = new mcp_js_1.McpServer({
        name: "dameng-database-mcp-server",
        version: "1.0.0",
    });
    // 注册工具 - 查询数据库 (使用 Zod schema)
    server.tool("query_database", "查询达梦数据库，可执行SQL SELECT语句，默认情况下禁止执行INSERT/UPDATE/DELETE/DDL语句", {
        sql: zod_1.z.string().describe("要执行的SQL查询语句"),
        allowAdvancedOperations: zod_1.z.boolean().optional().default(false).describe("是否允许执行INSERT、UPDATE、DELETE和DDL语句（默认为false）")
    }, async ({ sql, allowAdvancedOperations }) => {
        try {
            log(`收到查询请求: ${sql}`);
            // 执行数据库查询
            const result = await db.query(sql, allowAdvancedOperations || false);
            log(`查询完成，返回 ${result.rows.length} 条记录`);
            const response = {
                content: [{
                        type: "text",
                        text: JSON.stringify(result.rows, null, 2)
                    }]
            };
            if (result.warnings && result.warnings.length > 0) {
                response.content.push({
                    type: "text",
                    text: `\n警告: ${result.warnings.join('; ')}`
                });
            }
            return response;
        }
        catch (error) {
            log(`工具执行错误: ${error.message}`);
            return {
                content: [{
                        type: "text",
                        text: `错误: ${error.message}`
                    }],
                isError: true
            };
        }
    });
    // 启动服务器
    const transport = new stdio_js_1.StdioServerTransport();
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
    log(`应用启动失败: ${error.message}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map