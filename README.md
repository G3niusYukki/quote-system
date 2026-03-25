# 国际货代报价中台

<div align="center">

[![Docker](https://img.shields.io/docker/image-size/yukijudaii/quote-system/latest?logo=docker&label=Docker)](https://hub.docker.com/r/yukijudaii/quote-system)
[![CI](https://img.shields.io/github/actions/workflow/status/G3niusYukki/quote-system/ci.yml?logo=githubactions&label=CI)](https://github.com/G3niusYukki/quote-system/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql&logoColor=white)](#)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](#)

> 多租户架构的智能货代报价系统：Excel 上传 → AI 自动拆解报价规则 → 人工审核低置信度项 → 可解释报价 → 全链路可追溯。

</div>

---

## 核心价值流

```
  用户上传 Excel
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │           BullMQ 异步流水线（独立 Worker）        │
  │                                                 │
  │  ① 切块    按 Sheet 识别 pricing/surcharge/...   │
  │     ↓                                            │
  │  ② 归一化  字典映射国家/渠道/运输类型/货物类型     │
  │     ↓                                            │
  │  ③ AI 提取  DashScope qwen-plus，block_type 驱动  │
  │     ↓                                            │
  │  ④ 置信度  5 维度评分，80+ 自动通过              │
  │     ↓                                            │
  │  ⑤ 入库    high → rules，medium/low → 审核队列   │
  └─────────────────────────────────────────────────┘
       │
       ▼
  人工审核队列（仅低置信度项）
       │
       ▼
  发布规则版本 → 发布报价版本
       │
       ▼
  可解释询价计算
  · 命中渠道 + 基础报价
  · 附加费明细（含 raw_evidence 原文证据）
  · 未命中规则（含 reason）
```

---

## 功能特性

### ⚡ 智能导入流水线
Excel 上传后自动完成切块、归一化、AI 规则提取、置信度评分。全程异步，结果通过状态轮询获取。

### 🤖 AI 规则提取
基于阿里云百炼 DashScope（qwen-plus）自动解析报价结构。支持 5 种 block 类型：pricing / surcharge / restriction / billing_rule / notes。

### 📊 置信度评分体系
| 维度 | 分值 | 降分触发条件 |
|------|------|-------------|
| 表头清晰度 | 25 | 含额外修饰词（如"含税"）|
| 数据完整性 | 25 | 缺字段（1个扣10，2+扣25）|
| 条件明确性 | 25 | 跨 Sheet 引用，语义含糊 |
| 数值合理性 | 25 | 单价/重量明显异常 |
| 版本一致性 | 25 | 与旧版本规则冲突 |

- **≥80 分**：自动写入 rules 表，无需人工介入
- **50-79 分**：进入人工审核队列
- **<50 分**：标记待处理

### 🔍 人工审核队列
仅展示四要素：**原文片段** + **AI 提取结果** + **判低原因** + **建议修正**。支持接受 / 修正 / 标记无法处理三种操作。

### 📦 标准字典系统
支持国家、渠道、运输类型、货物类型、计费单位五大类归一化映射。消除 Excel 中的命名混乱。

### 🔄 版本管理
- **规则版本** + **报价版本** 双轨制
- 支持发布、差异对比、回滚
- 所有操作带 before/after 审计日志

### 💰 可解释报价引擎
每次询价返回完整价格组成明细：

```json
{
  "base_price": 150.00,
  "chargeable_weight": 15,
  "surcharges": [
    {
      "type": "偏远",
      "amount": 20.00,
      "raw_evidence": "阿拉斯加邮编加收20元（上A_v3, S2）",
      "hit_reason": "邮编 995 匹配偏远邮编段 995-999"
    }
  ],
  "unmatched_surcharges": [
    { "type": "超重", "reason": "实际重量15kg未达到超重阈值20kg" }
  ],
  "total": 170.00
}
```

### 🏢 多租户 + RBAC
Organization 级数据完全隔离。四角色矩阵：

| 操作 | owner | admin | member | viewer |
|------|:-----:|:-----:|:------:|:------:|
| 管理成员 | ✅ | ✅ | — | — |
| 上传 Excel | ✅ | ✅ | ✅ | — |
| 审核规则 | ✅ | ✅ | ✅ | — |
| 发布版本 | ✅ | ✅ | — | — |
| 询价查询 | ✅ | ✅ | ✅ | ✅ |
| 查看日志 | ✅ | ✅ | ✅ | ✅ |

---

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| **前端** | Next.js 15 + React 19 | App Router，服务端组件 |
| **语言** | TypeScript 5.6 | 严格模式，无 any |
| **样式** | Tailwind CSS 4 + shadcn/ui | v4 原生 CSS 语法 |
| **状态** | @tanstack/react-query v5 | 服务端状态管理 |
| **表单** | react-hook-form + Zod | 类型安全表单验证 |
| **后端** | Next.js API Routes | 42 个 REST 端点 |
| **数据库** | PostgreSQL 16 + Prisma 5 | 多租户 $extends 隔离 |
| **队列** | BullMQ 5 + Redis 7 | 持久化队列，指数退避重试 |
| **AI** | DashScope qwen-plus | Provider 接口可插拔 |
| **认证** | JWT + bcryptjs | HttpOnly Cookie + Bearer 双模式 |
| **解析** | SheetJS (xlsx) | Excel 解析 |
| **容器** | Docker + GitHub Actions | 一键构建推送至 Docker Hub |

---

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 步骤 1：克隆并安装

```bash
git clone https://github.com/G3niusYukki/quote-system.git
cd quote-system
npm install
```

### 步骤 2：配置环境变量

```bash
cp .env.example .env
```

必填项：
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/quote_system
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-32-char-random-secret
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 步骤 3：初始化数据库

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE quote_system;"

# 生成 Prisma Client
npm run db:generate

# 推送 schema（开发）
npm run db:push
# 或执行迁移（生产）
npm run db:migrate
```

### 步骤 4：启动 Worker（后台，必需）

```bash
# 终端 1
node workers/parse-excel.ts
```

### 步骤 5：启动开发服务器

```bash
# 终端 2
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) → 注册账号 → 开始使用。

### （可选）从旧系统迁移数据

```bash
npx tsx scripts/migrate-from-sqlite.ts
```

---

## 项目结构

```
quote-system/
├── app/
│   ├── (dashboard)/           # 受保护页面（需登录）
│   │   ├── dashboard/         # 控制台首页
│   │   ├── import-jobs/       # 导入任务中心
│   │   ├── review/            # AI 审核队列
│   │   ├── dictionaries/      # 标准字典管理
│   │   ├── rules/versions/   # 规则版本管理
│   │   ├── quotes/            # 报价管理
│   │   ├── team/members/      # 团队成员
│   │   ├── audit-logs/        # 审计日志
│   │   └── settings/          # 设置
│   ├── api/                   # REST API（42 端点）
│   ├── login/                 # 登录
│   └── register/              # 注册
│
├── components/
│   ├── ui/                    # shadcn/ui 基础组件
│   ├── sidebar.tsx            # 侧边导航
│   ├── quote-result-card.tsx  # 报价结果卡
│   ├── surcharge-breakdown.tsx # 附加费明细
│   ├── review-card.tsx        # 审核卡片
│   └── version-diff-viewer.tsx # 版本对比
│
├── lib/
│   ├── db.ts                  # Prisma 单例 + 多租户隔离
│   ├── auth.ts                # JWT 签名/验证
│   ├── auth-context.ts        # AsyncLocalStorage org 上下文
│   ├── request-auth.ts        # API 路由认证工具
│   ├── rbac/                  # RBAC 权限矩阵
│   ├── queue.ts               # BullMQ 队列初始化
│   ├── ai/
│   │   ├── provider.ts        # AI Provider 接口
│   │   ├── dashscope.ts       # DashScope 实现
│   │   └── prompts.ts         # prompt 模板
│   └── audit.ts               # 审计日志
│
├── workers/
│   └── parse-excel.ts         # BullMQ Worker（独立进程）
│
├── scripts/
│   ├── migrate-from-sqlite.ts # SQLite → PostgreSQL 迁移
│   └── seed-dictionaries.ts   # 字典初始化
│
└── prisma/
    └── schema.prisma          # 16 个 model
```

---

## 数据模型

```
Organization（租户隔离）
  │
  ├── User（成员 × 4 角色）
  │
  ├── ImportJob（Excel 导入任务）
  │     ├── ImportBlock（文件切片）
  │     │     └── ParseIssue（置信度问题 → 审核队列）
  │     │
  │     └── MappingDictionary（标准字典）
  │
  ├── RuleVersion（规则版本 · draft/published/archived）
  │     └── Rule（统一规则 DSL，含 raw_evidence）
  │
  ├── QuoteVersion（报价版本 · draft/published/archived）
  │     ├── Quote（渠道基础报价）
  │     ├── Surcharge（附加费）
  │     ├── BillingRule（计费规则）
  │     └── Restriction（限制规则）
  │
  ├── QueryHistory（询价历史）
  │
  └── AuditLog（审计日志 · before/after）
```

---

## 全部 API

所有端点需认证（除 `/api/auth/*` 和 `/api/status`）。

| 分类 | 端点 | 方法 |
|------|------|------|
| **认证** | `/api/auth/register` | POST |
| | `/api/auth/login` | POST |
| | `/api/auth/logout` | POST |
| | `/api/me` | GET |
| **导入** | `/api/import-jobs` | GET / POST |
| | `/api/import-jobs/:id` | GET |
| | `/api/import-jobs/:id/blocks` | GET |
| | `/api/import-jobs/:id/issues` | GET |
| | `/api/import-jobs/:id/retry` | POST |
| **规则** | `/api/rule-versions` | GET / POST |
| | `/api/rule-versions/:id` | GET / PATCH |
| | `/api/rule-versions/:id/publish` | POST |
| | `/api/rule-versions/:id/rollback` | POST |
| | `/api/rule-versions/:id/diff` | GET |
| | `/api/rules` | GET / POST |
| | `/api/rules/:id` | GET / PATCH / DELETE |
| | `/api/rules/bulk-import` | POST |
| **报价** | `/api/quotes/calculate` | POST |
| | `/api/quote-versions` | GET / POST |
| | `/api/quote-versions/:id` | GET / PATCH |
| | `/api/quote-versions/:id/publish` | POST |
| | `/api/quote-versions/:id/rollback` | POST |
| **审核** | `/api/review/issues` | GET |
| | `/api/review/issues/:id/resolve` | POST |
| **字典** | `/api/dictionaries` | GET / POST |
| | `/api/dictionaries/:id` | GET / PATCH / DELETE |
| | `/api/dictionaries/normalize` | POST |
| **团队** | `/api/organizations/:id` | GET / PATCH |
| | `/api/organizations/:id/members` | GET / POST |
| | `/api/organizations/:id/members/:uid` | PATCH / DELETE |
| | `/api/team/invite` | POST |
| **其他** | `/api/audit-logs` | GET |
| | `/api/history` | GET |
| | `/api/status` | GET（公开）|
| | `/api/config` | GET / PUT |

---

## 生产部署

### Docker（一键启动）

```bash
docker run -d \
  --name quote-system \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="your-32-char-secret" \
  -e DASHSCOPE_API_KEY="sk-..." \
  -e NODE_ENV=production \
  yukijudaii/quote-system:latest
```

### Docker Compose（推荐）

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: quote_system
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  worker:
    image: yukijudaii/quote-system:latest
    command: node workers/parse-excel.ts
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/quote_system
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change-me-in-production
      DASHSCOPE_API_KEY: sk-xxxx
      NODE_ENV: production
    depends_on:
      - postgres
      - redis

  app:
    image: yukijudaii/quote-system:latest
    command: node server.js
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/quote_system
      REDIS_URL: redis://redis:6379
      JWT_SECRET: change-me-in-production
      DASHSCOPE_API_KEY: sk-xxxx
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

> **注意**：Worker 必须与 Next.js 同时运行。Worker 负责 Excel 解析和 AI 规则提取，不可省略。

---

## 开发指南

### 添加新的 API 端点

```typescript
import { requireAuth, withOrgContext, withErrorHandler } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// app/api/resources/route.ts
export const GET = withErrorHandler(async (req) => {
  const auth = requireAuth(req);
  return withOrgContext(auth, async () => {
    const items = await prisma.resource.findMany();
    return Response.json({ items });
  });
});
```

### 调试 Worker

```bash
node workers/parse-excel.ts
# 或带详细日志
DEBUG=* node workers/parse-excel.ts
```

### 数据库图形化管理

```bash
npx prisma studio
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `REDIS_URL` | ✅ | Redis 连接字符串 |
| `JWT_SECRET` | ✅ | 生产环境至少 32 字符 |
| `DASHSCOPE_API_KEY` | ✅ | 阿里云百炼 API Key（格式：`sk-xxx`）|
| `NODE_ENV` | 推荐 | `production` 时 JWT 强制校验 |

---

<div align="center">

Built with Next.js 15 · TypeScript · PostgreSQL · BullMQ · Docker

</div>
