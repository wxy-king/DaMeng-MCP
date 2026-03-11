#!/bin/bash
# 达梦数据库MCP服务器安装脚本

echo "达梦数据库MCP服务器安装向导"

# 检查Node.js版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
echo "检测到Node.js版本: $NODE_VERSION"

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo "错误: npm 未找到，请先安装Node.js"
    exit 1
fi

echo "正在安装项目依赖..."
npm install

echo ""
echo "正在安装达梦数据库驱动..."

# 尝试安装不同的达梦驱动包
echo "尝试安装 dmhs (达梦官方驱动)..."
if npm install dmhs; then
    echo "✓ dmhs 安装成功"
else
    echo "⚠ dmhs 安装失败，尝试其他驱动包..."

    echo "尝试安装 @dameng/dm..."
    if npm install @dameng/dm; then
        echo "✓ @dameng/dm 安装成功"
    else
        echo "⚠ @dameng/dm 安装失败"

        echo "尝试安装 node-dm..."
        if npm install node-dm; then
            echo "✓ node-dm 安装成功"
        else
            echo "⚠ node-dm 安装失败"
            echo ""
            echo "警告: 未能自动安装达梦数据库驱动"
            echo "请手动安装达梦数据库的Node.js驱动:"
            echo "  npm install dmhs"
            echo "  或 npm install @dameng/dm"
            echo "  或其他达梦提供的Node.js驱动包"
        fi
    fi
fi

echo ""
echo "创建环境配置文件..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ 已创建 .env 文件，请根据实际情况修改数据库连接参数"
else
    echo "- .env 文件已存在，跳过创建"
fi

echo ""
echo "安装完成！"
echo ""
echo "要启动MCP服务器，请运行:"
echo "  npm run dev"
echo ""
echo "首次运行前，请确保:"
echo "1. 修改 .env 文件中的数据库连接参数"
echo "2. 确保达梦数据库服务正在运行"
echo "3. 确保网络可以访问达梦数据库服务器"