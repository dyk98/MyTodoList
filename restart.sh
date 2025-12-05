#!/bin/bash

# MyTodoList 项目重启脚本
# 用途：构建并启动/重启生产环境服务

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

APP_NAME="tickgo"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MyTodoList 项目重启脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 切换到项目目录
cd "$PROJECT_DIR"
echo -e "${GREEN}[1/6]${NC} 当前目录: $PROJECT_DIR"

# 检查 Node.js 和 npm 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm，请先安装 npm${NC}"
    exit 1
fi

echo -e "${GREEN}[2/6]${NC} Node 版本: $(node -v)"
echo -e "${GREEN}     ${NC} npm 版本: $(npm -v)"
echo ""

# 安装/更新依赖
echo -e "${YELLOW}[3/6]${NC} 安装依赖..."
npm install --production=false
echo ""

# 构建项目
echo -e "${YELLOW}[4/6]${NC} 构建项目..."
npm run build
echo ""

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}警告: 未找到 PM2，正在全局安装...${NC}"
    npm install -g pm2
    echo ""
fi

# 检查应用是否已在运行
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    # 应用已存在，执行重启
    echo -e "${YELLOW}[5/6]${NC} 重启应用..."
    pm2 restart "$APP_NAME"
else
    # 应用不存在，首次启动
    echo -e "${YELLOW}[5/6]${NC} 首次启动应用..."
    pm2 start npm --name "$APP_NAME" -- start
fi
echo ""

# 保存 PM2 配置（用于开机自启）
pm2 save

# 显示应用状态
echo -e "${YELLOW}[6/6]${NC} 应用状态:"
pm2 describe "$APP_NAME"
echo ""

# 显示最近日志
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 重启成功！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "应用名称: ${GREEN}$APP_NAME${NC}"
echo -e "访问地址: ${GREEN}http://localhost:3333${NC}"
echo ""
echo -e "常用命令:"
echo -e "  查看日志: ${BLUE}pm2 logs $APP_NAME${NC}"
echo -e "  查看状态: ${BLUE}pm2 status${NC}"
echo -e "  停止服务: ${BLUE}pm2 stop $APP_NAME${NC}"
echo -e "  重启服务: ${BLUE}pm2 restart $APP_NAME${NC}"
echo ""

# 显示最近的日志（最后 20 行）
echo -e "${YELLOW}最近日志:${NC}"
pm2 logs "$APP_NAME" --lines 20 --nostream
