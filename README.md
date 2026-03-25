# 国际快递报价智能系统

一个支持多上游的国际快递报价查询系统，支持 Excel 上传解析、AI 自动提取附加费规则、渠道智能匹配、规则人工管理。

## 功能特性

- **Excel 上传解析** — 拖拽上传报价 Excel，自动识别多渠道（Sheet）、国家、重量区间、单价等
- **AI 规则自动提取** — 上传时调用大模型自动从 Excel 中识别附加费、限制、赔偿、计费规则，无需手动配置
- **智能渠道匹配** — 按国家/运输类型/货物类型/重量/尺寸自动计算最优渠道含附加费总价
- **多上游支持** — 不同上游商可上传不同报价表，比价模式下自动选最低价
- **规则管理** — `/rules` 页面查看/编辑/新增/删除所有附加费规则，AI 规则可转为手动覆盖
- **AI 问答** — `/query` 页面支持对话询问报价规则，支持 Markdown 输出

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router, React 19) |
| 语言 | TypeScript (严格模式) |
| 数据库 | PostgreSQL (Prisma ORM) |
| 缓存/队列 | Redis + BullMQ |
| Excel 解析 | SheetJS (xlsx) |
| AI | 阿里云百炼 (DashScope) REST API |
| 样式 | Tailwind CSS |
| 鉴权 | JWT (cookie + header 双模式) |

## 新架构说明

### 数据库结构

系统使用多租户架构，通过 `organizationId` 实现数据隔离。核心数据模型：

- **Organization** — 租户/组织
- **RuleVersion** — 规则版本（每个 upstream 独立版本，published/draft/archived）
- **QuoteVersion** — 报价版本（与规则版本一一对应）
- **Quote** — 渠道报价明细（关联 QuoteVersion）
- **Rule** — 附加费/限制/赔偿/计费规则（关联 RuleVersion）
- **Surcharge** — 附加费（关联 QuoteVersion）
- **BillingRule** — 计费规则（关联 QuoteVersion）
- **Restriction** — 限制规则（关联 QuoteVersion）
- **ImportJob / ImportBlock / ParseIssue** — 导入流水线
- **AuditLog** — 操作审计日志
- **QueryHistory** — 询价历史

### 数据流向

```
Excel 上传 → ImportJob → ImportBlock → ParseIssue (AI 审核)
                                    ↓
                            RuleVersion (draft)
                                    ↓
                            QuoteVersion (draft)
                                    ↓
                              人工审核
                                    ↓
                            RuleVersion (published)
                            QuoteVersion (published)
                                    ↓
                              报价计算
```

### API 路由结构

```
/api/auth/*          — 登录/注册/登出
/api/organizations/* — 租户管理
/api/team/*          — 团队邀请
/api/rule-versions/* — 规则版本管理
/api/quote-versions/*— 报价版本管理
/api/rules/*         — 规则 CRUD
/api/quotes/*        — 报价查询
/api/dictionaries/*  — 标准字典
/api/import-jobs/*   — 导入任务
/api/review/*        — 审核队列
/api/history/*       — 询价历史
/api/audit-logs/*    — 审计日志
/api/status          — 系统状态
/api/config          — 配置管理
```

## 项目结构

```
quote-system/
├── app/                      # Next.js App Router 页面
│   ├── api/                   # API 路由
│   ├── (auth)/                # 认证页面
│   ├── (dashboard)/           # 仪表盘页面
│   │   ├── upload/            # Excel 上传
│   │   ├── rules/             # 规则管理
│   │   ├── query/             # 询价查询
│   │   ├── review/            # 审核队列
│   │   ├── settings/          # 设置
│   │   └── team/             # 团队管理
│   └── page.tsx               # 首页
├── components/                # React 组件
├── lib/                       # 核心库
│   ├── db.ts                  # Prisma 客户端 + 多租户隔离
│   ├── auth.ts                # JWT 工具
│   ├── error.ts               # 统一错误类
│   ├── rbac/                  # 权限控制
│   └── queue.ts               # BullMQ 队列
├── prisma/
│   └── schema.prisma          # 数据库 schema
├── scripts/                   # 工具脚本
│   └── migrate-from-sqlite.ts # SQLite → PostgreSQL 迁移
└── workers/                   # 后台任务
    └── parse-excel.ts         # Excel 解析 Worker
```

## 本地开发指南

### 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+（用于 BullMQ 队列）
- pnpm / npm

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入：
# DATABASE_URL=postgresql://user:password@localhost:5432/quote_system
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key
# DASHSCOPE_API_KEY=your-api-key
```

### 3. 数据库初始化

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到数据库（开发环境）
npm run db:push

# 或执行迁移（生产环境）
npm run db:migrate
```

### 4. 从 SQLite 迁移历史数据（可选）

如果有旧的 `data/quote.db`，运行迁移脚本：

```bash
npx tsx scripts/migrate-from-sqlite.ts
```

此脚本会：
- 创建 "Default" 组织
- 为每个上游创建 RuleVersion v1 (published) 和 QuoteVersion v1 (published)
- 迁移 quotes / surcharges / restrictions / billing_rules / compensation_rules / rules
- 从 `data/remote-zones.json` 导入偏远邮编附加费

### 5. 配置 API Key

复制配置模板并填入百炼 API Key：

```bash
cp data/config.example.json data/config.json
# 编辑 data/config.json，填入 dashscopeApiKey
```

或者在设置页面（`/settings`）直接填入。

### 6. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

### 7. 启动 Worker（后台任务）

Excel 解析和 AI 规则提取由 BullMQ Worker 处理：

```bash
npm run worker
```

Worker 处理：
- Excel 文件解析（ImportBlock 切片）
- AI 规则提取（ParseIssue）
- 置信度低的内容标记需人工审核

## 使用流程

### 第一步：上传报价 Excel

1. 打开 `/upload` 页面
2. 输入上游名称（如"顺丰小包"、"DHL"）
3. 拖拽上传 Excel 文件
4. 系统自动解析定价数据 + AI 提取附加费规则
5. 查看解析结果：定价记录数、AI 识别规则数、渠道列表

**Excel 格式说明**：
- 每个 Sheet 对应一个渠道（Sheet 名即渠道名）
- Sheet 中每行对应一个重量区间定价
- 需包含列：国家、运输类型、货物类型、最小重量、最大重量、单价等
- 附加费条款写在 Sheet 末尾任意位置，AI 自动识别

### 第二步：查询最优渠道

1. 打开 `/query` 页面
2. 选择目的国家、运输类型、货物类型
3. 填写实重和尺寸（长×宽×高 CM）
4. 选择物品类型（多选，如：内置电池、服装等）
5. 可选：勾选私人地址、填写收件邮编
6. 点击"查询最优渠道"，查看各渠道报价含附加费

### 第三步：管理规则（可选）

打开 `/rules` 页面：
- 查看 AI 提取的所有规则，带紫色"AI"标签
- 手动新增规则（绿色"手动"标签），会覆盖同条件的 AI 规则
- AI 规则点击"转为手动"可改为手动规则
- 点击"AI 重新提取"可基于已上传的 Excel 重新提取规则

## 规则系统说明

### 规则类型（category）

| category | 说明 |
|----------|------|
| `surcharge` | 附加费 |
| `restriction` | 限制/禁止条款 |
| `compensation` | 赔偿规则 |
| `billing` | 计费规则 |

### 附加费子类型（type）

| type | 说明 | 匹配方式 |
|------|------|----------|
| `私人地址` | 私人住宅地址附加费 | 用户勾选"私人地址"时触发 |
| `品类` | 特定货物类型附加费 | 用户选择的物品类型匹配 `item_type` |
| `超尺寸` | 单边/围长超限附加费 | 根据实际尺寸自动计算 |
| `超重` | 实重超限附加费 | 根据实际重量自动计算 |
| `材重超限` | 体积重超限附加费 | 根据体积重自动计算 |
| `异形包装` | 非标准包装附加费 | 规则存在即触发 |
| `偏远` | 偏远地区附加费 | 根据邮编判断 |

### charge_type 计费方式

| 值 | 说明 |
|----|------|
| `per_kg` | 按计费重量×单价收费 |
| `per_item` | 每件固定收费 |
| `fixed` | 固定金额（不乘重量） |

### 规则优先级

手动规则 > AI 规则（相同 `type` + `condition` 时手动优先）

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/rule-versions` | GET/POST | 获取/创建规则版本 |
| `/api/rule-versions/[id]/publish` | POST | 发布规则版本 |
| `/api/quote-versions` | GET/POST | 获取/创建报价版本 |
| `/api/quote-versions/[id]/publish` | POST | 发布报价版本 |
| `/api/rules` | GET/POST | 获取/新增规则 |
| `/api/rules/[id]` | PUT/DELETE | 编辑/删除单条规则 |
| `/api/quotes/calculate` | POST | 计算最优渠道（含附加费） |
| `/api/import-jobs` | GET/POST | 导入任务列表/创建 |
| `/api/review/issues` | GET | 待审核问题列表 |
| `/api/audit-logs` | GET | 审计日志 |
| `/api/history` | GET | 询价历史 |
| `/api/dictionaries` | GET | 标准字典 |
| `/api/status` | GET | 系统状态（数据统计） |
| `/api/config` | GET/PUT | 读取/写入配置 |
| `/api/auth/*` | * | 认证接口 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `REDIS_URL` | Redis 连接字符串（BullMQ） |
| `JWT_SECRET` | JWT 签名密钥 |
| `DASHSCOPE_API_KEY` | 百炼 API Key（优先级高于 config.json） |
| `NEXT_PUBLIC_*` | 前端环境变量（需 `NEXT_PUBLIC_` 前缀） |

## 数据存储

- PostgreSQL — 所有业务数据（通过 Prisma ORM 访问）
- Redis — BullMQ 任务队列、缓存
- `data/config.json` — API Key 配置（不提交到 git）
- `data/remote-zones.json` — 偏远邮编配置

## 部署

### 本地生产构建

```bash
npm run build
npm start
```

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run db:generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

需要同时启动 PostgreSQL 和 Redis 容器，或使用 Docker Compose 编排。
