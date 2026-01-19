#!/bin/bash

# GoProj Backend 初始化脚本
# 用于创建 Cloudflare Worker、D1 数据库和 R2 存储桶

set -e  # 遇到错误立即退出

echo "🚀 开始初始化 GoProj Backend..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查是否已登录
echo ""
echo "📋 检查 Cloudflare 登录状态..."
if ! npx wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ 请先运行: npx wrangler login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 已登录${NC}"

# 2. 创建 D1 数据库
echo ""
echo "📦 创建 D1 数据库..."
if npx wrangler d1 list | grep -q "goprog-db"; then
    echo -e "${YELLOW}⚠️  D1 数据库 goprog-db 已存在${NC}"
else
    echo "正在创建 goprog-db..."
    D1_OUTPUT=$(npx wrangler d1 create goprog-db)
    echo "$D1_OUTPUT"

    # 提取 database_id
    DATABASE_ID=$(echo "$D1_OUTPUT" | grep "database_id" | awk -F'"' '{print $4}')
    echo -e "${GREEN}✅ D1 数据库创建成功，ID: $DATABASE_ID${NC}"
fi

# 3. 创建 R2 存储桶
echo ""
echo "📁 创建 R2 存储桶..."
if npx wrangler r2 bucket list | grep -q "goprog-images"; then
    echo -e "${YELLOW}⚠️  R2 存储桶 goprog-images 已存在${NC}"
else
    npx wrangler r2 bucket create goprog-images
    echo -e "${GREEN}✅ R2 存储桶创建成功${NC}"
fi

# 4. 执行数据库 Schema
echo ""
echo "🗄️  执行数据库 Schema..."
echo "正在初始化数据库表..."
npx wrangler d1 execute goprog-db --file=src/db/schema.sql
echo -e "${GREEN}✅ 数据库 Schema 执行成功${NC}"

# 5. 构建项目
echo ""
echo "🔨 构建项目..."
npm run build
echo -e "${GREEN}✅ 构建完成${NC}"

# 6. 部署 Worker
echo ""
echo "🚀 部署 Worker..."
npx wrangler deploy
echo -e "${GREEN}✅ Worker 部署成功${NC}"

# 7. 测试部署
echo ""
echo "🧪 测试部署..."
echo "请稍等几秒，然后访问："
echo "  https://goprog-backend.yusuzhan.workers.dev"
echo ""
echo "测试 API："
echo "  curl https://goprog-backend.yusuzhan.workers.dev/"
echo "  curl https://goprog-backend.yusuzhan.workers.dev/api/issues"

echo ""
echo -e "${GREEN}🎉 初始化完成！${NC}"
echo ""
echo "📝 重要信息："
echo "  - Worker 名称: goprog-backend"
echo "  - D1 数据库: goprog-db"
echo "  - R2 存储桶: goprog-images"
echo "  - Worker URL: https://goprog-backend.yusuzhan.workers.dev"
echo ""
echo "⚠️  注意："
echo "  1. 请确认 wrangler.toml 中的 bindings 配置正确"
echo "  2. 如果需要重新创建，请先手动删除现有的 Worker、D1 和 R2"
