# 生产环境部署指南

本文档介绍如何将 MyTodoList 项目部署到生产服务器。

## 快速开始

**最简单的方式**是使用项目根目录的 `restart.sh` 脚本：

```bash
# 上传代码到服务器后，直接运行：
./restart.sh
```

该脚本会自动完成：
✓ 安装依赖
✓ 构建项目
✓ 启动/重启 PM2 服务
✓ 显示运行状态

服务将在 **3333 端口**启动。

---

## 部署架构

项目采用**单进程部署**方案：
- Express 服务同时提供 API 接口和前端静态文件
- 运行在 **3333 端口**（可通过环境变量 `PORT` 修改）
- 所有请求通过同一端口访问

## 部署步骤

### 1. 准备服务器环境

确保服务器已安装：
- **Node.js** >= 18.x
- **npm** >= 8.x

```bash
# 检查版本
node -v
npm -v
```

### 2. 上传代码到服务器

```bash
# 方式 1: 使用 git clone
git clone <your-repo-url>
cd MyTodoList

# 方式 2: 使用 scp 上传
scp -r /path/to/MyTodoList user@server:/path/to/deploy
```

### 3. 安装依赖

```bash
npm install
```

### 4. 构建项目

```bash
npm run build
```

此命令会：
1. 构建前端静态文件到 `dist/` 目录 (Vite)
2. 编译后端 TypeScript 代码到 `dist-server/` 目录

### 5. 启动服务

```bash
npm start
```

服务将在 **3333 端口**启动，访问：
```
http://your-server-ip:3333
```

## 使用一键重启脚本（推荐）

项目提供了 `restart.sh` 脚本，可以一键完成构建和重启：

```bash
./restart.sh
```

脚本功能：
- ✓ 自动安装依赖
- ✓ 构建前端和后端
- ✓ 使用 PM2 启动/重启服务
- ✓ 自动保存 PM2 配置（支持开机自启）
- ✓ 显示运行状态和最近日志

**首次部署**和**更新代码**都可以使用此脚本。

## 使用 PM2 管理进程（手动方式）

如果需要手动管理，PM2 可以让应用在后台运行，并在崩溃时自动重启。

### 安装 PM2

```bash
npm install -g pm2
```

### 启动应用

```bash
pm2 start npm --name "tickgo" -- start
```

### 常用 PM2 命令

```bash
# 查看运行状态
pm2 status

# 查看日志
pm2 logs tickgo

# 重启应用
pm2 restart tickgo

# 停止应用
pm2 stop tickgo

# 删除应用
pm2 delete tickgo

# 设置开机自启
pm2 startup
pm2 save
```

### PM2 配置文件（可选）

创建 `ecosystem.config.cjs`：

```javascript
module.exports = {
  apps: [{
    name: 'tickgo',
    script: 'dist-server/index.js',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
```

使用配置文件启动：
```bash
pm2 start ecosystem.config.cjs
```

## 使用 Nginx 反向代理（可选）

如果需要使用 80/443 端口或配置 HTTPS，可以使用 Nginx 反向代理。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 可选：重定向到 HTTPS
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 启用 HTTPS（使用 Let's Encrypt）

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 自动续期（每天检查两次）
sudo certbot renew --dry-run
```

## 环境变量

如需自定义配置，可以设置以下环境变量：

```bash
# .env 文件示例
NODE_ENV=production
PORT=3333
```

在 PM2 配置中使用：
```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3333
}
```

## 数据目录

项目数据存储在以下目录：
- `data/` - TODO 文件和用户数据
- `otherDocs/` - 文档文件

**重要**：请确保这些目录在服务器上存在，并定期备份。

## 故障排查

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3333

# 杀掉占用进程
kill -9 <PID>
```

### 2. 静态文件 404

检查 `dist/` 目录是否存在且包含文件：
```bash
ls -la dist/
```

如果缺失，重新构建：
```bash
npm run build:client
```

### 3. API 请求失败

检查后端编译产物：
```bash
ls -la dist-server/
```

查看服务日志：
```bash
pm2 logs tickgo
```

### 4. 权限问题

确保运行用户对 `data/` 和 `otherDocs/` 目录有读写权限：
```bash
chmod -R 755 data otherDocs
```

## 更新部署

### 方式 1：使用一键脚本（推荐）

```bash
# 拉取最新代码（如果使用 git）
git pull

# 一键重启
./restart.sh
```

### 方式 2：手动更新

```bash
# 1. 拉取最新代码
git pull

# 2. 安装新依赖（如果有）
npm install

# 3. 重新构建
npm run build

# 4. 重启服务
pm2 restart tickgo
```

## 监控和日志

### 查看实时日志
```bash
pm2 logs tickgo --lines 100
```

### 监控资源使用
```bash
pm2 monit
```

## 安全建议

1. **使用防火墙**：只开放必要的端口（80, 443, SSH）
2. **定期更新**：保持 Node.js 和依赖包更新
3. **备份数据**：定期备份 `data/` 目录
4. **使用 HTTPS**：生产环境必须启用 HTTPS
5. **限制访问**：配置 Nginx 速率限制和访问控制

## 性能优化

1. **启用 Gzip 压缩**（Nginx）：
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

2. **静态文件缓存**（Nginx）：
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **PM2 集群模式**（多核服务器）：
```javascript
instances: 'max',  // 或指定数字
exec_mode: 'cluster'
```

## 联系支持

如遇到问题，请查看：
- GitHub Issues: <your-repo-issues-url>
- 项目文档: CLAUDE.md
