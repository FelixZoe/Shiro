# Shiro

一个为 Mix Space 生态设计的极简个人网站前端。

> [!IMPORTANT]
> 本分支已经适配当前 Mix Space Core：使用 `/api/v3`、PostgreSQL 16、Redis、独立迁移容器和新版 API Client。它不再按旧 Core 10 / MongoDB 部署方式运行。

## 技术栈

- Next.js 16（App Router）
- React 19
- Tailwind CSS v4 / DaisyUI v5
- TanStack Query
- Jotai
- Socket.IO
- Mix Space API Client 5.6 运行时兼容层

## 当前部署架构

```text
Browser
  ├─ Shiro :2323
  └─ Core API / Socket.IO :2333
          ├─ PostgreSQL 16
          ├─ Redis 7
          ├─ /root/.mx-space 持久化目录
          └─ mx-migrate 一次性迁移任务
```

Shiro 本身不直接访问数据库。PostgreSQL、Redis 和数据库迁移属于 Core 服务；Shiro 只通过 Core `/api/v3` 获取数据。

## Docker Compose（推荐）

### 1. 准备配置

```bash
git clone https://github.com/FelixZoe/Shiro.git
cd Shiro
cp .env.example .env
```

生成安全密钥：

```bash
openssl rand -base64 48
openssl rand -hex 32
```

把输出分别填入 `.env`：

```env
JWT_SECRET=第一条命令的输出
ENCRYPT_KEY=第二条命令的输出
POSTGRES_PASSWORD=强数据库密码
```

本地运行可保留：

```env
PUBLIC_CORE_ORIGIN=http://localhost:2333
PUBLIC_CORE_API_URL=http://localhost:2333/api/v3
ALLOWED_ORIGINS=localhost,127.0.0.1
```

生产环境应改为浏览器可以访问的 HTTPS 地址，例如：

```env
PUBLIC_CORE_ORIGIN=https://api.example.com
PUBLIC_CORE_API_URL=https://api.example.com/api/v3
ALLOWED_ORIGINS=example.com,www.example.com
```

`PUBLIC_CORE_*` 不能填写 `http://core:2333`。`core` 只是 Docker 内部服务名，访客浏览器无法解析它。Compose 已自动给服务端渲染配置内部地址 `http://core:2333/api/v3`。

### 2. 启动

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs mx-migrate
docker compose logs -f core shiro
```

正常启动顺序是：

1. PostgreSQL 与 Redis 健康检查通过。
2. `mx-migrate` 执行 Drizzle schema migration 和 Core 应用数据迁移，然后以状态码 0 退出。
3. Core 启动并通过 `/api/v3/ping` 健康检查。
4. Shiro 启动并通过 `/api/health` 健康检查。

`mx-migrate` 显示 `Exited (0)` 是正常状态，不是服务崩溃。

### 3. 数据目录

```text
data/postgres   PostgreSQL 数据
data/redis      Redis AOF 数据
data/mx-space   Core 上传文件、备份及运行数据
```

升级或迁移服务器前，至少备份 `data/postgres` 和 `data/mx-space`。更稳妥的 PostgreSQL 备份方式：

```bash
docker compose exec -T postgres \
  pg_dump -U mx -d mx_core -Fc > mx_core.dump
```

### 4. 更新

```bash
git pull
docker compose pull core mx-migrate postgres redis
docker compose build --pull shiro
docker compose up -d
```

每次 Core 镜像升级后都让 `mx-migrate` 正常执行，不要直接跳过迁移容器启动 Core。

## 从旧 MongoDB 部署迁移

> [!WARNING]
> 这是一次硬切换。普通 `mx-migrate` 只升级 PostgreSQL schema，不能把 MongoDB 数据转换为 PostgreSQL。必须使用 Core 官方 `@mx-space/mongo-pg-cli`。

### 1. 冻结写入并备份

只停止旧 Core 应用，保持旧 MongoDB 在线：

```bash
docker compose stop app
```

备份 MongoDB 和旧文件目录：

```bash
docker exec -i $(docker ps -q -f name=mongo) \
  mongodump --archive --gzip > backup-mongo-$(date +%Y%m%d).archive.gz

tar czf backup-mx-space-$(date +%Y%m%d).tar.gz ./data/mx-space
```

不要先删除旧 MongoDB 容器或 volume。迁移工具只读 MongoDB，不会修改源数据。

### 2. 只启动 PostgreSQL 和 Redis

```bash
docker compose up -d postgres redis
docker compose ps
```

### 3. 配置旧 MongoDB 地址

旧 MongoDB 已映射到宿主机 27017 时，在 `.env` 中填写：

```env
MONGO_URI=mongodb://host.docker.internal:27017/mx-space
MIGRATION_MODE=dry-run
MIGRATION_SNOWFLAKE_WORKER_ID=900
```

旧 MongoDB 仍是一个 Docker 容器时，可以把它接入当前网络，再使用容器名：

```bash
docker network connect shiro-core_mx-space mongo
```

```env
MONGO_URI=mongodb://mongo:27017/mx-space
```

实际网络名可用 `docker network ls` 查看。

### 4. 先 dry-run

```bash
docker compose --profile mongo-migration run --rm mongo-to-postgres
```

重点检查输出：

- `Rows allocated` 与旧站文章、评论等数量大致一致。
- `Missing refs` 没有异常的大量缺失。
- 最后没有致命错误。

### 5. 再 apply

确认 dry-run 正常后：

```bash
MIGRATION_MODE=apply \
  docker compose --profile mongo-migration run --rm mongo-to-postgres
```

`apply` 是幂等的，可以在中断后重跑；`mongo_id_map` 会保证同一条 MongoDB 数据继续使用相同的 Snowflake ID。

### 6. 启动并核对

```bash
docker compose up -d --build
docker compose ps
docker compose logs mx-migrate
docker compose logs -f core shiro
```

上线前逐项核对：文章、页面、评论、用户、订阅、附件、图片、搜索、RSS 和站点地图。确认无误后再切换域名；在稳定观察期结束前保留旧 MongoDB 备份和容器。

## 只部署 Shiro

Core 已经独立部署时，可以只构建 Shiro：

```bash
docker build -t shiro:local .

docker run -d \
  --name shiro \
  -p 2323:2323 \
  -e NEXT_PUBLIC_API_URL=https://api.example.com/api/v3 \
  -e NEXT_PUBLIC_CLIENT_API_URL=https://api.example.com/api/v3 \
  -e NEXT_PUBLIC_GATEWAY_URL=https://api.example.com \
  shiro:local
```

三个地址的作用：

- `NEXT_PUBLIC_API_URL`：服务端渲染访问 Core 的地址。
- `NEXT_PUBLIC_CLIENT_API_URL`：浏览器访问 Core API 的公开地址。
- `NEXT_PUBLIC_GATEWAY_URL`：Socket.IO 网关公开地址，不带 `/api/v3`。

## Vercel 部署

Shiro 部署到 Vercel、Core 部署到服务器时，在 Vercel 项目中设置：

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api/v3
NEXT_PUBLIC_CLIENT_API_URL=https://api.example.com/api/v3
NEXT_PUBLIC_GATEWAY_URL=https://api.example.com
```

PostgreSQL、Redis、`PG_*` 和 `JWT_SECRET` 属于 Core，不应配置到 Shiro 的 Vercel 项目中。

## 本地开发

```bash
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install --frozen-lockfile
cp apps/web/.env.template apps/web/.env
pnpm dev
```

默认端口：

- Shiro：`2323`
- Core：`2333`
- Core API：`http://localhost:2333/api/v3`

## 许可

项目采用 AGPLv3，并附加仓库中的 [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md)。
