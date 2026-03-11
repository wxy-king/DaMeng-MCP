/**
 * 达梦数据库驱动安装脚本
 * 此脚本会尝试安装合适的达梦数据库驱动
 */

console.log('正在检查并安装达梦数据库驱动...\n');

const { execSync } = require('child_process');
const fs = require('fs');

// 尝试安装不同的达梦驱动包
const driverPackages = ['dmhs', '@dameng/dm', 'node-dm'];

let installed = false;
for (const pkg of driverPackages) {
  try {
    console.log(`尝试安装 ${pkg}...`);
    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
    console.log(`✓ ${pkg} 安装成功\n`);
    installed = true;
    break;
  } catch (error) {
    console.log(`⚠ ${pkg} 安装失败\n`);
  }
}

if (!installed) {
  console.log('警告: 未能自动安装达梦数据库驱动');
  console.log('请手动安装达梦数据库的Node.js驱动:');
  console.log('  npm install dmhs');
  console.log('  或 npm install @dameng/dm');
  console.log('  或其他达梦提供的Node.js驱动包\n');
}

// 检查是否有.env文件，如果没有则创建
if (!fs.existsSync('.env')) {
  console.log('创建环境配置文件...');
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✓ 已复制 .env.example 到 .env，请根据实际情况修改数据库连接参数');
  } else {
    console.log('⚠ 未找到 .env.example 文件');
  }
} else {
  console.log('- .env 文件已存在，跳过创建');
}

console.log('\n安装检查完成！');