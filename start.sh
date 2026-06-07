#!/bin/bash

# AuraMusic 启动脚本
# 用于启动 AuraMusic 音乐播放器应用

set -e

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PID_FILE="$PROJECT_DIR/.next/dev/server.pid"
LOG_FILE="$PROJECT_DIR/.next/dev/logs/development.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Node.js 是否安装
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js 未安装，请先安装 Node.js (推荐版本 >= 18)"
        exit 1
    fi
    info "Node.js 版本: $(node --version)"
}

# 检查依赖是否已安装
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        warn "依赖包未安装，正在安装..."
        npm install
        if [ $? -ne 0 ]; then
            error "依赖安装失败"
            exit 1
        fi
        info "依赖安装成功"
    else
        info "依赖已安装"
    fi
}

# 停止正在运行的服务器
stop_server() {
    info "检查端口 3000 占用情况..."
    
    # 停止可能存在的 Next.js 进程
    pkill -f "next dev" 2>/dev/null || true
    
    # 等待进程停止
    sleep 2
    
    # 使用 fuser 检查端口占用（更可靠）
    if command -v fuser &> /dev/null; then
        fuser -k 3000/tcp 2>/dev/null || true
    fi
    
    info "端口清理完成"
}

# 启动开发服务器
start_server() {
    info "启动 AuraMusic 开发服务器..."
    
    # 创建日志目录
    mkdir -p "$PROJECT_DIR/.next/dev/logs"
    
    # 启动服务器（后台运行）
    cd "$PROJECT_DIR"
    npm run dev > "$LOG_FILE" 2>&1 &
    
    # 等待服务器启动
    info "等待服务器启动..."
    sleep 3
    
    # 检查服务器是否成功启动
    if curl -s http://localhost:3000 > /dev/null; then
        info "AuraMusic 服务器已成功启动！"
        info "访问地址: http://localhost:3000"
        info "日志文件: $LOG_FILE"
    else
        error "服务器启动失败，请检查日志文件: $LOG_FILE"
        cat "$LOG_FILE"
        exit 1
    fi
}

# 主函数
main() {
    echo "=========================================="
    echo "         AuraMusic 启动脚本"
    echo "=========================================="
    
    cd "$PROJECT_DIR"
    
    check_node
    check_dependencies
    stop_server
    start_server
    
    echo "=========================================="
}

# 执行主函数
main "$@"
