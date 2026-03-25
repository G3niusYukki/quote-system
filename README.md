# 国际货代报价中台

多租户架构的智能货代报价系统：任意上游 Excel 导入 → AI 自动拆解报价结构和加价规则 → 人工审核低置信度项 → 可解释报价 → 全链路可追溯。

## 核心功能

| 功能 | 说明 |
|------|------|
| **异步导入流水线** | Excel 上传后异步解析切块、字典归一化、AI 规则提取、置信度评分 |
| **置信度审核** | 低置信度规则进入人工审核队列，只展示原文/AI提取/原因/建议四要素 |
| **标准字典系统** | 国家/渠道/运输类型/货物类型/计费单位归一化，消除 Excel 命名混乱 |
| **规则 DSL** | 统一规则结构：触发条件、适用品类、计费维度、收费方式、原文证据 |
| **可解释报价** | 每次报价返回命中链路、附加费来源文件片段、价格组成明细 |
| **版本管理** | 规则版本 + 报价版本，支持发布、差异对比、回滚 |
| **多租户 + RBAC** | Organization 数据隔离，四角色权限（owner/admin/member/viewer）|
| **审计日志** | 所有操作 before/after 记录，可按用户/操作类型/时间筛选 |

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Next.js 15 (App Router) + React 19 |
| 开发语言 | TypeScript（严格模式）|
| UI 组件 | Tailwind CSS 4 + shadcn/ui 风格组件 |
| 数据获取 | @tanstack/react-query v5 |
| 表单验证 | react-hook-form + Zod |
| 后端框架 | Next.js API Routes |
| 数据库 | PostgreSQL + Prisma ORM 5 |
| 任务队列 | BullMQ 5 + Redis 7 |
| AI 层 | 抽象 Provider 接口，V1 接入阿里云百炼 DashScope（qwen-plus）|
| 认证 | JWT（HttpOnly Cookie + Authorization Header 双模式）+ bcryptjs |
| Excel 解析 | SheetJS（xlsx）|

## 架构概览

```
用户上传 Excel
       │
       ▼
  ImportJob（状态：pending）
       │
       ▼
  BullMQ 任务入队
       │
       ▼
  Worker（独立 Node.js 进程）
       ├── 切块：按 Sheet 识别 pricing/surcharge/restriction/notes/clause
       ├── 归一化：字典映射国家/渠道/运输类型/货物类型/单位
       ├── AI 提取：DashScope qwen-plus，按 block_type 构造 prompt
       ├── 置信度评分：5 维度（0-25 各），总分 80+ 自动通过
       └── 入库：high → rules 表，medium/low → ParseIssue（待审核）
       │
       ▼
  人工审核队列（仅低置信度项）
       ├── 原文片段
       ├── AI 提取结果
       ├── 判低置信度原因
       └── 建议修正项
       │
       ▼
  规则发布 → 报价发布
       │
       ▼
  询价计算（可解释模式）
       ├── 命中渠道 + 基础报价
       ├── 附加费明细（含 raw_evidence 和 hit_reason）
       └── 未命中规则（含 reason）
```

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 必填项：
# DATABASE_URL=postgresql://postgres:password@localhost:5432/quote_system
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key-min-32-chars
# DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 初始化数据库

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE quote_system;"

# 生成 Prisma Client
npm run db:generate

# 开发环境：推送 schema（不创建迁移历史）
npm run db:push

# 生产环境：执行迁移
npm run db:migrate
```

### 4. 启动 Worker（后台任务，必需）

Worker 是独立 Node.js 进程，负责 Excel 解析和 AI 规则提取：

```bash
# 终端 1
node workers/parse-excel.ts
```

### 5. 启动开发服务器

```bash
# 终端 2
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

### 6. 从旧系统迁移数据（可选）

如果有 `data/quote.db` SQLite 数据库，运行迁移脚本：

```bash
npx tsx scripts/migrate-from-sqlite.ts
```

迁移内容：
- 所有 quotes / surcharges / restrictions / billing_rules / rules
- 从 `data/remote-zones.json` 导入偏远邮编附加费
- 创建 "Default" Organization，版本 v1 (published)

### 7. 初始化字典数据

```bash
# 先注册账号，获取 organizationId
# 然后用 orgId 运行 seed
ORG_ID=<your-org-id> npx tsx scripts/seed-dictionaries.ts
```

或访问 `/settings/api-keys` 配置 API Key 后，直接在前端 UI 初始化字典。

---

## 项目结构

```
quote-system/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # 受保护页面（需登录）
│   │   ├── dashboard/          # 控制台首页
│   │   ├── import-jobs/        # 导入任务中心
│   │   ├── review/             # 审核队列
│   │   ├── dictionaries/        # 字典管理
│   │   ├── rules/versions/     # 规则版本管理
│   │   ├── quotes/             # 报价管理
│   │   ├── team/members/      # 团队成员
│   │   ├── audit-logs/        # 审计日志
│   │   └── settings/           # 设置页
│   ├── api/                    # API 路由（42 个端点）
│   ├── login/                 # 登录页
│   └── register/               # 注册页
│
├── components/                  # React 组件
│   ├── ui/                     # shadcn/ui 基础组件
│   ├── sidebar.tsx             # 侧边导航
│   ├── topbar.tsx              # 顶栏
│   ├── quote-result-card.tsx   # 报价结果卡
│   ├── surcharge-breakdown.tsx  # 附加费明细
│   ├── review-card.tsx         # 审核卡片
│   ├── version-diff-viewer.tsx # 版本对比
│   └── ...
│
├── lib/                        # 核心库
│   ├── db.ts                   # Prisma 单例 + 多租户隔离（$extends）
│   ├── auth.ts                 # JWT 签名/验证/cookie 工具
│   ├── auth-context.ts         # AsyncLocalStorage org 上下文
│   ├── auth-provider.tsx       # React auth context（客户端）
│   ├── request-auth.ts         # API 路由认证工具（服务端）
│   ├── rbac/                   # RBAC 权限矩阵
│   ├── queue.ts                # BullMQ 队列初始化
│   ├── ai/                     # AI 层
│   │   ├── provider.ts         # AI Provider 接口
│   │   ├── dashscope.ts        # V1 DashScope 实现
│   │   └── prompts.ts          # 各 block_type 的 prompt 模板
│   ├── audit.ts                # 审计日志写入工具
│   ├── error.ts                # 统一错误类 + withErrorHandler
│   └── utils.ts                # cn() 等工具函数
│
├── workers/
│   └── parse-excel.ts           # BullMQ Worker（Excel 解析流水线）
│
├── scripts/
│   ├── migrate-from-sqlite.ts  # SQLite → PostgreSQL 迁移
│   └── seed-dictionaries.ts      # 字典数据初始化
│
├── prisma/
│   └── schema.prisma           # 数据库 schema（16 个 model）
│
├── middleware.ts               # JWT 验证中间件
└── next.config.ts              # Next.js 配置
```

## 数据模型

```
Organization（租户）
  └── User（成员，4 种角色）
  └── ImportJob（导入任务）
        └── ImportBlock（文件切片）
              └── ParseIssue（置信度问题）
  └── MappingDictionary（标准字典）
  └── RuleVersion（规则版本，draft/published/archived）
        └── Rule（规则 DSL）
  └── QuoteVersion（报价版本）
        └── Quote（渠道报价）
        └── Surcharge（附加费）
        └── BillingRule（计费规则）
        └── Restriction（限制规则）
  └── QueryHistory（询价历史）
  └── AuditLog（审计日志）
```

## API 路由

所有 API 均需认证（除 `/api/auth/*` 和 `/api/status`）。

### 认证

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 注册（创建 Organization + Owner 账号）|
| `/api/auth/login` | POST | 登录，返回 JWT（Cookie）|
| `/api/auth/logout` | POST | 登出，清除 Cookie |
| `/api/auth/register-by-invite` | POST | 通过邀请链接注册 |
| `/api/me` | GET | 当前用户信息 |

### 导入任务

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/import-jobs` | GET | 任务列表（分页/筛选）|
| `/api/import-jobs` | POST | 创建任务，上传文件 |
| `/api/import-jobs/:id` | GET | 任务详情 |
| `/api/import-jobs/:id/blocks` | GET | 切片列表 |
| `/api/import-jobs/:id/issues` | GET | 置信度问题列表 |
| `/api/import-jobs/:id/retry` | POST | 重试失败任务 |

### 规则与版本

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/rule-versions` | GET/POST | 版本列表/创建 |
| `/api/rule-versions/:id` | GET/PATCH | 版本详情/编辑 |
| `/api/rule-versions/:id/publish` | POST | 发布版本 |
| `/api/rule-versions/:id/rollback` | POST | 回滚到上一版本 |
| `/api/rule-versions/:id/diff?compare_to=` | GET | 与指定版本对比 |
| `/api/rules` | GET/POST | 规则列表/创建 |
| `/api/rules/:id` | GET/PATCH/DELETE | 单条规则 CRUD |
| `/api/rules/bulk-import` | POST | 从已审阅 blocks 批量导入 |

### 报价

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/quotes/calculate` | POST | 可解释报价计算 |
| `/api/quote-versions` | GET/POST | 报价版本列表/创建 |
| `/api/quote-versions/:id` | GET/PATCH | 报价版本详情 |
| `/api/quote-versions/:id/publish` | POST | 发布报价版本 |
| `/api/quote-versions/:id/rollback` | POST | 回滚报价版本 |

### 审核队列

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/review/issues` | GET | 低置信度问题列表 |
| `/api/review/issues/:id/resolve` | POST | 审核处理（accept/correct/unresolvable）|

### 字典

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/dictionaries` | GET/POST | 字典列表/创建 |
| `/api/dictionaries/:id` | GET/PATCH/DELETE | 字典 CRUD |
| `/api/dictionaries/normalize` | POST | 文本归一化 |

### 团队

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/organizations/:id` | GET/PATCH | 组织信息 |
| `/api/organizations/:id/members` | GET/POST | 成员列表/添加 |
| `/api/organizations/:id/members/:uid` | PATCH/DELETE | 角色更新/移除 |
| `/api/team/invite` | POST | 生成邀请链接 |

### 其他

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/audit-logs` | GET | 审计日志（分页/筛选）|
| `/api/history` | GET | 询价历史 |
| `/api/status` | GET | 系统状态（无需认证）|
| `/api/config` | GET/PUT | AI API Key 配置 |

## 报价计算 API 详解

**POST /api/quotes/calculate**

```json
// 请求
{
  "country": "美国",
  "transport_type": "海运",
  "cargo_type": "普货",
  "actual_weight": 15,
  "volume_weight": 12,
  "dimensions": { "L": 50, "W": 40, "H": 30 },
  "postcode": "99501",
  "item_types": ["电池"],
  "is_private_address": false,
  "upstream": "上游A"
}

// 响应
{
  "quote": {
    "base_price": 150.00,
    "chargeable_weight": 15,
    "matched_channel": {
      "id": "xxx",
      "name": "美国专线-经济",
      "zone": "美国东岸",
      "unit_price": 10.00
    }
  },
  "surcharges": [
    {
      "type": "偏远",
      "name": "偏远附加费",
      "amount": 20.00,
      "calculation": "固定收取",
      "rule_id": "xxx",
      "raw_evidence": "阿拉斯加邮编加收20元（上A_v3, S2）",
      "hit_reason": "邮编 995 匹配偏远邮编段 995-999"
    }
  ],
  "unmatched_surcharges": [
    {
      "type": "超重",
      "rule_id": "xxx",
      "reason": "实际重量15kg未达到超重阈值20kg"
    }
  ],
  "total": 170.00,
  "rule_version_id": "xxx",
  "quote_version_id": "xxx"
}
```

## 置信度评分

| 维度 | 满分 | 降分条件 |
|------|------|----------|
| 表头清晰度 | 25 | 含额外修饰词（如"含税"）|
| 数据完整性 | 25 | 缺字段（1 个扣 10 分，2+ 扣 25 分）|
| 条件明确性 | 25 | 跨 sheet 引用，语义含糊 |
| 数值合理性 | 25 | 单价/重量明显异常 |
| 版本一致性 | 25 | 与旧版本规则冲突 |

总分 ≥ 80：自动通过，写入 rules 表
总分 50-79：需人工审核，写入 ParseIssue
总分 < 50：标记待处理

## 角色权限

| 操作 | owner | admin | member | viewer |
|------|-------|-------|--------|--------|
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 上传 Excel | ✅ | ✅ | ✅ | ❌ |
| 审核规则 | ✅ | ✅ | ✅ | ❌ |
| 发布版本 | ✅ | ✅ | ❌ | ❌ |
| 询价查询 | ✅ | ✅ | ✅ | ✅ |
| 查看日志 | ✅ | ✅ | ✅ | ✅ |

## 生产部署

### 环境变量

```bash
# .env.production
DATABASE_URL=postgresql://user:pass@host:5432/quote_system
REDIS_URL=redis://host:6379
JWT_SECRET=<32-char-random-string>
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
NODE_ENV=production
```

### 构建

```bash
npm run build
```

### 启动（需要同时运行 Worker）

```bash
# Worker
node workers/parse-excel.ts &

# Next.js
npm start
```

### Docker Compose 示例

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
    build: .
    command: node workers/parse-excel.ts
    env_file: .env
    depends_on:
      - postgres
      - redis

  app:
    build: .
    command: npm start
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

## 开发指南

### 添加新的 API 路由

1. 在 `app/api/` 下创建目录和 `route.ts`
2. 使用 `withOrgContext` 包装查询，自动带 orgId 过滤
3. 使用 `requireAuth` 验证登录
4. 使用 `requirePermission(req, 'action')` 检查权限
5. 使用 `withErrorHandler` 统一错误处理

示例：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, withOrgContext, withErrorHandler } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  requirePermission(req, "upload_excel");

  return withOrgContext(auth, async () => {
    // 业务逻辑
    await writeAudit({ action: "rule.create", entityType: "Rule", after: newRule, req });
    return NextResponse.json(newRule, { status: 201 });
  });
});
```

### 添加新的前端页面

1. 在 `app/(dashboard)/` 下创建页面
2. 页面自动受中间件保护（未登录重定向到 /login）
3. 使用 `@tanstack/react-query` 管理服务端状态
4. 使用 shadcn/ui 组件（从 `@/components/ui/` 导入）

### 调试 Worker

Worker 日志输出到 stdout，出现错误时记录 `errorMessage` 到 `ImportJob`：

```bash
node workers/parse-excel.ts
# 或带详细日志
DEBUG=* node workers/parse-excel.ts
```

### 数据库操作

```bash
# 打开 Prisma Studio（图形化界面）
npx prisma studio

# 重置数据库（慎用）
npx prisma db push --force-reset

# 查看生成的 SQL
npx prisma migrate dev --create-only
```
