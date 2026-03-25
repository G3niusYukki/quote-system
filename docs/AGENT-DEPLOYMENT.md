# AI Agent 部署指南

> 本文档面向 AI Agent（Claude Code、Cursor 等）编写，用于帮助 AI Agent 理解项目架构、依赖关系，并独立完成部署、调试、二次开发等任务。

---

## 系统概述

### 项目定位
国际货代报价中台（International Freight Quote Platform）

### 核心价值流
```
Excel 上传 → ImportJob → BullMQ Worker → ImportBlock + ParseIssue
                                              ↓
                                         AI 规则提取
                                              ↓
                                    人工审核（仅低置信度）
                                              ↓
                                    RuleVersion (published)
                                              ↓
                                    QuoteVersion (published)
                                              ↓
                                    可解释报价计算
```

---

## 依赖关系图

```
Node.js 运行时
  ├── Next.js 15 App（端口 3000）
  │     ├── API Routes（认证 + 业务逻辑）
  │     └── 前端页面（React 19）
  │
  ├── Worker 进程（独立进程，不能在 Next.js 内嵌）
  │     ├── BullMQ Consumer（从 Redis 拉任务）
  │     ├── Excel 解析（SheetJS）
  │     └── AI 调用（DashScope HTTP API）
  │
  ├── PostgreSQL（主数据库）
  │     └── Prisma ORM（类型安全查询）
  │
  └── Redis（任务队列）
        └── BullMQ（持久化队列 + 重试机制）
```

**关键约束：Worker 必须作为独立 Node.js 进程运行，不能放在 Next.js server 内嵌。**

---

## 环境变量清单

所有环境变量定义在 `.env.example` 中，部署时必须配置：

| 变量 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | ✅ | 格式：`postgresql://user:pass@host:5432/dbname` |
| `REDIS_URL` | Redis 连接字符串 | ✅ | 格式：`redis://host:6379`，无密码则省略 auth 部分 |
| `JWT_SECRET` | 字符串 | ✅ | JWT 签名密钥，生产环境至少 32 字符随机字符串 |
| `DASHSCOPE_API_KEY` | 百炼 API Key | ✅ | 阿里云百炼 API Key，格式：`sk-xxxxxxxx` |
| `NODE_ENV` | `development` \| `production` | 推荐 | 影响 Cookie Secure 标志和 JWT Secret 校验逻辑 |

**注意：** `DASHSCOPE_API_KEY` 也可存储在 `data/config.json` 中（优先级低于环境变量）。如果两者都未设置，AI 提取功能将失败。

---

## 部署步骤（逐条执行）

### 步骤 1：环境检查

```bash
# 验证 Node.js 版本
node --version  # 需要 >= 20.0.0

# 验证 PostgreSQL 可访问
psql "$DATABASE_URL" -c "SELECT 1;"

# 验证 Redis 可访问
redis-cli -u "$REDIS_URL" PING  # 应返回 PONG

# 验证 npm 可用
npm --version
```

### 步骤 2：安装依赖

```bash
npm install
```

此命令安装所有依赖，包括：
- Prisma CLI（开发依赖）
- BullMQ + ioredis
- bcryptjs + jsonwebtoken
- SheetJS（Excel 解析）
- Tailwind CSS
- shadcn/ui 基础组件

### 步骤 3：数据库初始化

```bash
# 如果数据库不存在，先创建
psql "$DATABASE_URL" -c "CREATE DATABASE quote_system;"

# 生成 Prisma Client（从 schema 生成类型安全客户端）
npm run db:generate

# 推送 schema 到数据库（开发环境，推荐）
npm run db:push

# 或执行迁移（生产环境，创建迁移历史）
npm run db:migrate
```

**验证数据库初始化成功：**

```bash
# 查看生成的表
psql "$DATABASE_URL" -c "\dt"
# 应看到 16 张表：Organization, User, ImportJob, ImportBlock, ParseIssue, MappingDictionary, RuleVersion, Rule, QuoteVersion, Quote, Surcharge, BillingRule, Restriction, AuditLog, QueryHistory
```

### 步骤 4：验证构建

```bash
npm run build
```

如果构建成功，会在 `.next/` 目录生成生产构建产物。如果失败，检查：
- TypeScript 编译错误
- 环境变量是否缺失
- Prisma Client 是否已生成

### 步骤 5：启动 Worker

Worker 必须先于 Next.js 启动（或同时启动）：

```bash
# 方式 A：直接运行
node workers/parse-excel.ts

# 方式 B：使用 tsx 运行 TypeScript 源文件（开发环境）
npx tsx workers/parse-excel.ts

# 方式 C：使用 PM2 管理（生产环境推荐）
npm install -g pm2
pm2 start workers/parse-excel.ts --name quote-worker
```

Worker 启动后会：
1. 连接 Redis，创建/连接 `parse-excel` 队列
2. 监听任务，开始消费

### 步骤 6：启动 Next.js

```bash
# 开发环境
npm run dev

# 生产环境
npm run build && npm start
```

应用启动后访问 `http://localhost:3000`。

### 步骤 7：注册第一个账号

1. 访问 `/register`
2. 填写组织名称、姓名、邮箱、密码
3. 注册成功后自动登录，跳转到 `/dashboard`
4. 第一个注册的用户自动成为该组织的 **owner**

---

## 数据迁移（旧系统 → 新系统）

如果有旧系统 `data/quote.db`（SQLite），执行迁移：

```bash
npx tsx scripts/migrate-from-sqlite.ts
```

**前提条件：**
1. PostgreSQL 数据库已初始化（schema 已推送）
2. `data/quote.db` 文件存在于项目根目录
3. `data/remote-zones.json` 文件存在

**迁移脚本行为：**
1. 读取 SQLite 中所有表的数据
2. 在 PostgreSQL 创建 "Default" Organization
3. 按 upstream 创建 RuleVersion v1 (published) 和 QuoteVersion v1 (published)
4. 迁移所有 quotes / surcharges / restrictions / billing_rules / rules
5. 从 `remote-zones.json` 读取偏远邮编，写入 `surcharges` 表 `category=remote`
6. 打印迁移统计（每个表迁移了多少条记录）

---

## 字典初始化

字典用于将 Excel 中的不规范命名归一化：

```bash
# 需要先知道 organizationId（从数据库查询）
ORG_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM \"Organization\" LIMIT 1;" | xargs)
echo "ORG_ID: $ORG_ID"
npx tsx scripts/seed-dictionaries.ts
```

或者在前端 UI 操作：设置页面 → API Key 配置 → 字典管理 → 初始化预设数据。

---

## 常见部署问题

### 问题 1：Worker 无法连接 Redis

**症状：** `Worker` 报错 `Error: Redis connection timeout`

**排查：**
```bash
redis-cli -u "$REDIS_URL" PING
# 如果不是 PONG，检查 REDIS_URL 是否正确
```

**修复：** 确认 `REDIS_URL` 格式正确，且 Redis 服务已启动。

---

### 问题 2：Prisma Client 找不到

**症状：** `Cannot find module '@prisma/client'` 或类型错误

**排查：**
```bash
ls node_modules/@prisma/client/
```

**修复：**
```bash
npm run db:generate
```

---

### 问题 3：JWT 认证失败（生产环境）

**症状：** 登录后立即跳转回登录页

**原因：** 生产环境中 `JWT_SECRET` 使用了弱密钥或未设置，`lib/auth.ts` 会拒绝启动。

**修复：** 设置强随机密钥：
```bash
openssl rand -base64 32  # 生成 32 字符随机密钥
# 复制输出，设置到 JWT_SECRET 环境变量
```

---

### 问题 4：AI 规则提取失败

**症状：** ImportJob 状态为 `failed`，错误信息包含 `401` 或 `DashScope`

**排查：**
```bash
# 检查 API Key 配置
curl https://dashscope.aliyuncs.com/api/v1/models \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY"
```

**修复：**
1. 确认百炼 API Key 有效
2. 设置环境变量或编辑 `data/config.json`
3. 重试失败的 ImportJob：`POST /api/import-jobs/:id/retry`

---

### 问题 5：多租户数据泄露

**症状：** 用户 A 能看到用户 B 的数据

**排查：** 检查 Prisma Client 是否使用了 `$extends` 的 org 隔离中间件：
```typescript
// lib/db.ts 应包含类似以下代码：
client.$extends({
  model: {
    $allModels: {
      async findMany({ args, next }) {
        const orgId = getOrgId(); // 从 AsyncLocalStorage 获取
        args.where = { ...args.where, organizationId: orgId };
        return next(args);
      }
    }
  }
})
```

**修复：** 如果 org 隔离失效，检查 `lib/request-auth.ts` 中 `withOrgContext` 是否正确设置了 AsyncLocalStorage。

---

### 问题 6：Worker 进程崩溃后任务丢失

**症状：** ImportJob 一直在 `pending` 状态，Worker 已停止

**修复：**
1. 重启 Worker
2. 检查 ImportJob 状态，如果是 `pending`，调用重试接口：
```bash
curl -X POST http://localhost:3000/api/import-jobs/<job-id>/retry \
  -H "Cookie: auth_token=<token>"
```

**预防：** 生产环境使用 PM2 或 systemd 管理 Worker 进程，设置自动重启。

---

## 二次开发指南

### 添加新的 API 端点

1. 在 `app/api/<resource>/route.ts` 创建路由文件
2. 使用以下辅助函数：

```typescript
import { requireAuth, withOrgContext, withErrorHandler } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// 完整示例
export const GET = withErrorHandler(async (req: Request) => {
  const auth = requireAuth(req);                          // 验证登录
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page")) || 1;

  return withOrgContext(auth, async () => {
    const items = await prisma.rule.findMany({
      where: { /* 自动带上 organizationId 过滤 */ },
      skip: (page - 1) * 20,
      take: 20,
    });
    return Response.json({ items, page });
  });
});
```

### 添加新的数据库 Model

1. 编辑 `prisma/schema.prisma`，添加 model
2. 运行 `npm run db:push`（开发）或 `npm run db:migrate`（生产）
3. `npm run db:generate` 生成新的 Prisma Client 类型
4. 在 `lib/db.ts` 的 `$extends` 中添加 org 隔离支持

### 添加新的权限检查

编辑 `lib/rbac/index.ts`：

```typescript
const PERMISSIONS: Record<Action, Role[]> = {
  // ... 现有权限
  my_new_action: ["owner", "admin"],  // 添加新权限
};

export function requirePermission(req: Request, action: Action): void {
  // ... 现有逻辑
}
```

---

## 生产环境清单

部署到生产前，逐项确认：

- [ ] `DATABASE_URL` 指向生产 PostgreSQL（非本地）
- [ ] `REDIS_URL` 指向生产 Redis（非本地）
- [ ] `JWT_SECRET` 设置为强随机密钥（≥32 字符）
- [ ] `DASHSCOPE_API_KEY` 已配置且有效
- [ ] `NODE_ENV=production`
- [ ] 数据库 schema 已推送（`npm run db:push` 或 `npm run db:migrate`）
- [ ] `npm run build` 构建成功
- [ ] Worker 进程使用 PM2/systemd 管理（自动重启）
- [ ] PostgreSQL 有定期备份
- [ ] Redis 开启持久化（`appendonly yes`）
- [ ] `.env` 不提交到 git（已加入 `.gitignore`）
- [ ] `data/config.json` 不提交到 git（已加入 `.gitignore`）
