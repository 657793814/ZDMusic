#!/bin/bash

# AuraMusic 停止脚本
# 用于停止正在执行的后台播放服务

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

# 停止服务器
stop_server() {
    info "停止 ZDMusic 服务器..."
    
    # 检查PID文件是否存在
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        info "读取到进程ID: $PID"
        
        # 检查进程是否存在
        if kill -0 "$PID" 2>/dev/null; then
            info "正在停止进程 $PID..."
            kill "$PID" 2>/dev/null || true
            
            # 等待进程停止
            info "等待进程停止..."
            sleep 2
            
            # 检查进程是否已停止
            if kill -0 "$PID" 2>/dev/null; then
                warn "进程 $PID 未正常停止，尝试强制终止..."
                kill -9 "$PID" 2>/dev/null || true
                sleep 1
            fi
            
            info "进程已停止"
        else
            warn "进程 $PID 不存在，可能已停止"
        fi
        
        # 删除PID文件
        rm -f "$PID_FILE"
        info "已清理PID文件"
    else
        warn "未找到PID文件，尝试通过进程名查找并停止..."
    fi
    
    # 使用pkill确保所有相关进程都停止
    info "检查并清理剩余进程..."
    pkill -f "next dev" 2>/dev/null || true
    sleep 1
    
    # 使用fuser检查端口占用（更可靠）
    if command -v fuser &> /dev/null; then
        if fuser -n tcp 3000 2>/dev/null | grep -q .; then
            info "清理端口 3000..."
            fuser -k 3000/tcp 2>/dev/null || true
        fi
    fi
    
    info "服务器已停止"
}

# 主函数
main() {
    echo "=========================================="
    echo "         ZDMusic 停止脚本"
    echo "=========================================="
    
    cd "$PROJECT_DIR"
    
    stop_server
    
    echo "=========================================="
    info "ZDMusic 服务器已成功停止！"
}

# 执行主函数
main "$@"