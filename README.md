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

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **数据库**: SQLite (better-sqlite3)
- **Excel 解析**: SheetJS (xlsx)
- **AI**: 阿里云百炼 (DashScope) REST API
- **样式**: Tailwind CSS

## 项目结构

```
quote-system/
├── app/                      # Next.js App Router 页面
│   ├── api/
│   │   ├── chat/             # AI 问答接口
│   │   ├── config/            # 配置文件读写
│   │   ├── match/             # 渠道匹配计算
│   │   ├── rules/             # 规则 CRUD + AI 重新提取
│   │   ├── status/            # 系统状态
│   │   └── upload/            # Excel 上传解析
│   ├── query/                 # 查询页面（/query）
│   ├── rules/                 # 规则管理页面（/rules）
│   ├── settings/              # 设置页面（/settings）
│   ├── upload/                # 上传页面（/upload）
│   └── page.tsx               # 首页
├── components/                # React 组件
│   ├── ChatInterface.tsx       # AI 对话组件
│   ├── MatchForm.tsx           # 匹配查询表单
│   ├── RuleForm.tsx            # 规则编辑弹窗
│   └── UploadForm.tsx          # Excel 上传组件
├── lib/
│   ├── chat.ts                 # 百炼 API 调用封装
│   ├── config.ts               # 配置文件读写
│   ├── db.ts                   # SQLite 数据库层
│   ├── parser.ts               # Excel 硬编码解析器
│   └── rule-extractor.ts       # AI 规则提取器
├── types/
│   └── index.ts                # TypeScript 类型定义
└── data/                      # 运行时数据（不提交到 git）
    ├── config.json             # API Key 配置（不提交）
    └── quote.db                # SQLite 数据库（不提交）
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制配置模板并填入你的百炼 API Key：

```bash
cp data/config.example.json data/config.json
# 编辑 data/config.json，填入 dashscopeApiKey
```

或者在设置页面（`/settings`）直接填入。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

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
| `/api/upload` | POST | 上传 Excel，解析定价 + AI 提取规则 |
| `/api/match` | POST | 查询最优渠道（含附加费计算） |
| `/api/rules` | GET/POST | 获取/新增规则 |
| `/api/rules/[id]` | PUT/DELETE | 编辑/删除单条规则 |
| `/api/rules/extract` | GET | 触发 AI 重新提取规则 |
| `/api/chat` | POST | AI 规则问答 |
| `/api/status` | GET | 系统状态（数据量、最近上传） |
| `/api/config` | GET/PUT | 读取/写入配置文件 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DASHSCOPE_API_KEY` | 百炼 API Key（优先级高于 config.json） |
| `NEXT_PUBLIC_*` | 前端环境变量（需要 `NEXT_PUBLIC_` 前缀） |

## 数据存储

- `data/quote.db` — SQLite 数据库文件
- `data/config.json` — API Key 配置（不提交到 git）
- `data/upload_history` — 上传历史（含 Excel 原文，供 AI 重新提取用）

数据库包含以下表：`quotes`、`surcharges`、`restrictions`、`compensation_rules`、`billing_rules`、`rules`、`upload_history`

## 部署

### 本地生产构建

```bash
npm run build
npm start
```

### Vercel 部署

```bash
npm i -g vercel
vercel
```

注意：SQLite（better-sqlite3）在 Vercel Serverless 环境需要使用 `@libsql/client` 替代，或使用持久化存储方案。

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
