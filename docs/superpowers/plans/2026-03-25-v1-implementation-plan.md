# 国际货代报价中台 — 全面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有货代报价系统从 SQLite 单租户架构，重构为 PostgreSQL + Redis + BullMQ + 多租户的可解释报价中台，交付 V1 完整功能（导入流水线、规则 DSL、字典系统、审核队列、报价解释、版本管理、团队权限、审计日志）。

**Architecture:** Next.js 15 App Router 重构，Prisma ORM 连接 PostgreSQL，BullMQ + Redis 驱动异步导入流水线，JWT 认证 + Organization 行级隔离，shadcn/ui 构建管理界面，AI Provider 抽象层 V1 接入 DashScope。

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL, Prisma ORM, Redis, BullMQ, shadcn/ui, Tailwind CSS 4, JWT, DashScope API

---

## 阶段一：项目初始化与基础设施

### 1.1 Next.js 15 项目重构

- Create: `package.json`（Next.js 15, TypeScript, Prisma, BullMQ, redis, jsonwebtoken, bcryptjs, zod, react-hook-form, @tanstack/react-query, shadcn/ui 依赖）
- Create: `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `.env.example`（DATABASE_URL, REDIS_URL, JWT_SECRET, DASHSCOPE_API_KEY）
- Modify: 删除旧 `app/` `lib/` `components/` `types/`，替换为新项目结构

### 1.2 Prisma Schema

- Create: `prisma/schema.prisma`
  - 所有 models: Organization, User, ImportJob, ImportBlock, ParseIssue, MappingDictionary, RuleVersion, Rule, QuoteVersion, Quote, Surcharge, BillingRule, Restriction, AuditLog
  - 所有 relation 和 field（见设计文档 3.2 节）
  - `@@index` 优化（organization_id, upstream, status 等高频查询字段）
- Create: `prisma/migrations/` 初始迁移

### 1.3 数据库初始化

- Run: `prisma migrate dev --name init`
- Run: `prisma generate`
- 验证：所有表创建成功，relations 正确

### 1.4 Redis + BullMQ 初始化

- Create: `lib/queue.ts` — BullMQ Queue/Worker 初始化，连接 Redis
- Create: `lib/db.ts` — Prisma Client 单例
- Create: `lib/auth.ts` — JWT 签名/验证工具

### 1.5 认证系统

- Create: `app/api/auth/login/route.ts` — 邮箱密码登录，返回 JWT
- Create: `app/api/auth/logout/route.ts`
- Create: `middleware.ts` — JWT 验证中间件，保护所有非公开路由
- Create: `lib/auth-context.ts` — 当前用户上下文（organization_id, role）

### 1.6 多租户行级隔离

- Create: `lib/org.ts` — Prisma middleware，强制所有查询带上 `organization_id`
- Modify: 所有 API routes，在 handler 入口处提取 `req.auth.orgId` 并注入查询上下文

---

## 阶段二：导入任务流水线

### 2.1 导入任务 API

- Create: `app/api/import-jobs/route.ts` POST — 文件上传，生成 job_id，状态=pending，BullMQ 入队
- Create: `app/api/import-jobs/route.ts` GET — 分页列表（按 organization 过滤）
- Create: `app/api/import-jobs/[id]/route.ts` GET — 任务详情
- Create: `app/api/import-jobs/[id]/blocks/route.ts` GET — 获取任务关联的所有切片（分页 + 筛选 needs_review）
- Create: `app/api/import-jobs/[id]/issues/route.ts` GET — 获取任务关联的所有置信度问题（分页 + 筛选 issue_type）
- Create: `app/api/import-jobs/[id]/retry/route.ts` POST — 重试失败任务

### 2.2 BullMQ Worker — Excel 解析与切块

- Create: `workers/parse-excel.ts` — BullMQ Worker 入口
- Step 1（切块）: 读取 Excel，按 sheet 识别表头行，分类内容块（pricing/surcharges/restrictions/notes/clause），写入 import_blocks
- Step 2（归一化）: 调用字典归一化接口，标准化国家/渠道/运输类型/货物类型/计费单位
- Step 3（AI 提取）: 按 block_type 构造 prompt，调用 AI Provider，解析 JSON 输出
- Step 4（置信度评分）: 5 维度评分，总分 0-100，80+ 自动通过，50-79/0-49 进 parse_issues
- Step 5（入库）: high 规则直接写入 rules 表，medium/low 写入 parse_issues，状态更新为 completed/failed

**重试策略：**
- Worker 最多重试 3 次（`attempts: 3`）
- 可重试错误：AI API 超时/限流（status 429/500/503）、Redis 连接瞬时断开
- 不可重试错误：文件格式损坏（malformed Excel）、MD5 校验失败、数据类型断言失败 → 直接标记 `status=failed`，记录 `error_message`，不重试
- 重试间隔：指数退避（10s → 30s → 90s）
- 永久失败：3 次重试后仍失败，状态改为 `failed`，保留 error_message，允许用户手动触发重试（`POST /api/import-jobs/:id/retry`）

### 2.3 AI Provider 抽象层

- Create: `lib/ai/provider.ts` — AI Provider 接口（`extract(blockType, rawText): Promise<AIResult>`）
- Create: `lib/ai/dashscope.ts` — V1 DashScope 实现（qwen-plus）
- Create: `lib/ai/prompts.ts` — 各 block_type 的 prompt 模板

### 2.4 导入任务前端

- Create: `app/import-jobs/page.tsx` — 任务列表页
- Create: `app/import-jobs/new/page.tsx` — 上传文件页（拖拽上传 + 上游选择）
- Create: `app/import-jobs/[id]/page.tsx` — 任务详情页（blocks/issues/preview 标签）
- Create: `components/import-job-status-badge.tsx`
- Create: `components/import-block-list.tsx`

---

## 阶段三：字典系统

### 3.1 字典 CRUD API

- Create: `app/api/dictionaries/route.ts` GET/POST
- Create: `app/api/dictionaries/[id]/route.ts` PUT/DELETE
- Create: `app/api/dictionaries/normalize/route.ts` POST — 归一化接口（传入任意字符串，返回标准值或候选列表）

### 3.2 字典前端

- Create: `app/dictionaries/page.tsx` — 字典管理首页（按 category Tabs 展示）
- Create: `app/dictionaries/[category]/page.tsx` — 某 category 字典列表
- Create: `components/dictionary-form.tsx` — 新增/编辑映射弹窗
- Seed: 预设常用字典数据（国家/运输类型/货物类型/计费单位）

---

## 阶段四：规则 DSL 与审核队列

### 4.1 规则 API

- Create: `app/api/rules/route.ts` GET（列表）/POST — 列表支持按 version_id/category/type 筛选
- Create: `app/api/rules/[id]/route.ts` GET/PUT/DELETE — 单条规则详情、编辑、删除（前端版本详情页依赖 GET /rules/:id）
- Create: `app/api/rules/bulk-import/route.ts` POST — 从已审阅 blocks 批量导入规则

### 4.2 审核队列 API

- Create: `app/api/review/issues/route.ts` GET — 低置信度问题列表
- Create: `app/api/review/issues/[id]/resolve/route.ts` POST — 审核处理
  - 接受：写入 rules 表，更新 import_block.confidence=100, needs_review=false
  - 修正：更新字段值，写入 rules（source=manual）
  - 无法解析：标记状态，不进入规则 DSL

### 4.3 审核队列前端

- Create: `app/review/page.tsx` — 审核队列首页（按 issue_type 分组统计）
- Create: `app/review/[issueId]/page.tsx` — 单项审核页（四要素展示）
- Create: `components/review-card.tsx` — 审核卡片（原文/AI提取/原因/建议/操作按钮）
- Create: `components/rule-inline-editor.tsx` — 字段修正编辑器

---

## 阶段五：报价引擎可解释模式

### 5.1 报价计算 API

- Create: `app/api/quotes/calculate/route.ts` POST
  - 加载已发布 quote_version
  - 查询匹配渠道，计算基础报价
  - 枚举 surcharge 规则（6 类含 private_address），逐条判断命中
  - 枚举 billing_rules 应用计费规则
  - 返回可解释结构（基础报价 + surcharge 明细含 raw_evidence + unmatched 规则含原因）
- Modify: 远程分区判断逻辑（从 `data/remote-zones.json` 文件迁移到数据库 `surcharges` 表 `category=remote` 行，源文件路径：`/Users/peterzhang/quote-system/data/remote-zones.json`）

### 5.2 报价前端

- Create: `app/quotes/calculate/page.tsx` — 询价页（表单 + 可解释结果）
- Create: `components/quote-result-card.tsx` — 报价结果展示（基础价 + 附加费明细）
- Create: `components/surcharge-breakdown.tsx` — 附加费明细（含命中原因和原文证据）

---

## 阶段六：版本管理

### 6.1 规则版本 API

- Create: `app/api/rule-versions/route.ts` GET/POST
- Create: `app/api/rule-versions/[id]/route.ts` GET/PUT
- Create: `app/api/rule-versions/[id]/publish/route.ts` POST
- Create: `app/api/rule-versions/[id]/rollback/route.ts` POST
- Create: `app/api/rule-versions/[id]/diff/route.ts` GET — 与指定版本对比（added/removed/changed/unchanged）

### 6.2 报价版本 API

- Create: `app/api/quote-versions/route.ts` GET/POST
- Create: `app/api/quote-versions/[id]/route.ts` GET — 版本详情；**PUT（可选）**：draft 状态下可编辑基本信息（关联 rule_version_id）
- Create: `app/api/quote-versions/[id]/publish/route.ts` POST
- Create: `app/api/quote-versions/[id]/rollback/route.ts` POST

### 6.3 版本管理前端

- Create: `app/rules/versions/page.tsx` — 规则版本列表
- Create: `app/rules/versions/[id]/page.tsx` — 版本详情（规则列表 + 状态）
- Create: `app/rules/versions/[id]/diff/page.tsx` — 版本对比页
- Create: `app/quotes/versions/page.tsx` — 报价版本列表
- Create: `app/quotes/versions/[id]/page.tsx` — 报价版本详情
- Create: `components/version-diff-viewer.tsx` — 差异对比组件

---

## 阶段七：团队成员与权限

### 7.1 成员管理 API

- Create: `app/api/organizations/[id]/route.ts` GET/PUT
- Create: `app/api/organizations/[id]/members/route.ts` GET/POST
- Create: `app/api/organizations/[id]/members/[userId]/route.ts` PUT/DELETE
- Create: `app/api/team/invite/route.ts` POST — 生成邀请链接（可选）

### 7.2 权限控制

- Create: `lib/rbac.ts` — 权限矩阵（owner/admin/member/viewer × 操作）
- Modify: 所有 API routes，在 handler 入口处检查 role 权限
- Create: `components/permission-guard.tsx` — 前端权限守卫组件

### 7.3 团队前端

- Create: `app/team/members/page.tsx` — 成员列表
- Create: `app/team/invite/page.tsx` — 邀请成员页
- Create: `components/member-role-select.tsx` — 角色选择器
- Create: `components/invite-member-modal.tsx`

---

## 阶段八：审计日志

### 8.1 审计日志 API

- Create: `app/api/audit-logs/route.ts` GET — 分页列表（按 organization/user/action 筛选）
- Create: `lib/audit.ts` — 审计日志写入工具函数（before/after JSON，记录 IP）

### 8.2 审计日志前端

- Create: `app/audit-logs/page.tsx` — 审计日志列表页（时间/用户/操作类型/实体筛选）
- Create: `components/audit-log-row.tsx` — 日志行组件（展开查看 before/after JSON）

---

## 阶段九：前端公共页面

### 9.1 布局与导航

- Create: `app/layout.tsx` — 根布局（SessionProvider + 布局）
- Create: `app/(dashboard)/layout.tsx` — Dashboard 布局（侧边栏 + 顶栏）
- Create: `components/sidebar.tsx` — 侧边导航
- Create: `components/topbar.tsx` — 顶栏（团队切换 + 用户菜单）

### 9.2 控制台首页

- Create: `app/page.tsx` → 重定向到 `/dashboard`
- Create: `app/dashboard/page.tsx` — 首页（统计卡片 + 待审核数 + 快速询价入口 + 最近导入任务）

### 9.3 登录页

- Create: `app/login/page.tsx` — 登录页
- Create: `app/register/page.tsx` — 注册页（创建第一个 Organization + Owner 账号）

### 9.4 设置页

- Create: `app/settings/profile/page.tsx` — 个人设置
- Create: `app/settings/organization/page.tsx` — 组织设置
- Create: `app/settings/api-keys/page.tsx` — AI API Key 配置

---

## 阶段十：数据迁移与收尾

### 10.1 SQLite 数据迁移

- Create: `scripts/migrate-from-sqlite.ts` — 一次性迁移脚本
  - 从 `data/quote.db` 读取现有数据
  - 插入 PostgreSQL（新 organization = "Default"）
  - 规则迁移到 rule_version（version=1, status=published）
  - 报价迁移到 quote_version（version=1, status=published）
- Run: 迁移脚本并验证数据完整性

### 10.2 系统状态检查

- Create: `app/api/status/route.ts` — 系统状态（数据统计 + 规则版本数 + 上游列表）

### 10.3 错误处理与日志

- Create: `lib/error.ts` — 统一错误类（AppError + HTTP 状态码映射）
- Modify: 所有 API routes 统一错误处理（try/catch → AppError → 统一响应格式）

### 10.4 文档

- Update: `README.md` — 新架构说明 + 本地开发指南
- Update: `docs/` — API 文档（可选用 Swagger 或直接写 Markdown）

---

## 依赖关系图

```
阶段一（基础设施）
    ↓
阶段二（导入流水线）→ 依赖阶段一
阶段三（字典系统）→ 依赖阶段一
    ↓
阶段四（规则+审核）→ 依赖阶段二 + 阶段三
    ↓
阶段五（报价引擎）→ 依赖阶段三 + 阶段四
阶段六（版本管理）→ 依赖阶段四 + 阶段五
阶段七（团队权限）→ 依赖阶段一
阶段八（审计日志）→ 依赖阶段七
    ↓
阶段九（前端页面）→ 贯穿所有阶段
    ↓
阶段十（数据迁移）→ 收尾
```

## 验收标准

- [ ] 所有 API routes 有正确权限控制（未登录返回 401，权限不足返回 403）
- [ ] Excel 导入完整走通：上传 → 切块 → AI 提取 → 置信度评分 → 写入/进审核
- [ ] 审核队列：低置信度项展示四要素，审核后规则自动晋升
- [ ] 报价计算：返回可解释结构，含 raw_evidence 和命中原因
- [ ] 版本管理：发布后不可修改，支持 diff 对比和 rollback
- [ ] 原有 SQLite 数据完整迁移到 PostgreSQL
- [ ] 所有页面正确渲染，角色权限生效
