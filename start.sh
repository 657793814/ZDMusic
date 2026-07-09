#!/bin/bash

# ZDMusic 启动脚本
# 用于启动 ZDMusic 音乐播放器 Web应用

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
    info "检查并停止当前项目的服务器..."
    
    # 优先使用 PID 文件停止进程（只针对当前项目）
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            info "通过 PID 文件终止进程 $PID..."
            kill "$PID" 2>/dev/null || true
            # 等待进程停止
            sleep 2
            # 如果进程还在运行，强制终止
            if kill -0 "$PID" 2>/dev/null; then
                info "强制终止进程 $PID..."
                kill -9 "$PID" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    # 检查当前项目目录下是否还有残留的 next dev 进程（通过 cwd 判断）
    # 避免影响其他项目
    CURRENT_PID=$(pgrep -f "next dev" | head -n 1)
    if [ -n "$CURRENT_PID" ]; then
        # 获取进程的工作目录
        PROCESS_CWD=$(readlink /proc/"$CURRENT_PID"/cwd 2>/dev/null || true)
        if [ "$PROCESS_CWD" = "$PROJECT_DIR" ]; then
            info "终止当前项目的 next dev 进程 $CURRENT_PID..."
            kill "$CURRENT_PID" 2>/dev/null || true
            sleep 1
        fi
    fi
    
    info "服务器停止完成"
}

# 启动开发服务器
start_server() {
    info "启动 ZDMusic 开发服务器..."
    
    # 创建日志目录
    mkdir -p "$PROJECT_DIR/.next/dev/logs"
    
    # 先执行构建
    info "执行 npm run build..."
    cd "$PROJECT_DIR"
    npm run build
    if [ $? -ne 0 ]; then
        error "构建失败，请检查错误信息"
        exit 1
    fi
    info "构建成功"
    
    # 启动开发服务器（后台运行）
    npm run dev > "$LOG_FILE" 2>&1 &
    
    # 记录进程ID
    echo $! > "$PID_FILE"
    
    # 等待服务器启动
    info "等待服务器启动..."
    sleep 3
    
    # 检查服务器是否成功启动
    if curl -s http://localhost:3000 > /dev/null; then
        info "ZDMusic 服务器已成功启动！"
        info "访问地址: http://localhost:3000"
        info "日志文件: $LOG_FILE"
        info "进程ID: $(cat "$PID_FILE")"
    else
        error "ZDMusic 服务器启动失败，请检查日志文件: $LOG_FILE"
        cat "$LOG_FILE"
        exit 1
    fi
}

# 主函数
main() {
    echo "=========================================="
    echo "         ZDMusic 启动脚本"
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
