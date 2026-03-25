# 国际货代报价中台 — 全面重构设计文档

**版本**: 1.0
**日期**: 2026-03-25
**状态**: 已批准，待实施

---

## 一、产品定位

**国际货代报价中台**。核心价值：任意上游 Excel 导入 → 自动拆解可执行规则 → 人工审核低置信度项 → 可解释报价 → 全链路可追溯。

### 核心卖点
- 任意上游 Excel 导入后，系统自动拆解报价结构和加价规则
- 大部分规则自动通过，低置信度规则进入人工确认
- 最终报价可解释、可追溯、可复盘，团队统一口径

### V1 交付范围
1. 导入任务中心（异步上传 → 切块 → AI 提取 → 置信度评分）
2. 规则审核队列（只展示低置信度风险点，人工判断）
3. 标准字典系统（国家/渠道/运输类型/货物类型/计费单位归一化）
4. 规则 DSL（统一规则结构，可执行可追溯）
5. 报价引擎可解释模式（命中链路 + 原文证据 + 价格组成）
6. 版本管理（规则版本 + 报价版本 + 差异对比 + 回滚）
7. 团队成员 + 角色权限 + 操作日志

**V1 交付周期**: 8-10 周

---

## 二、技术栈

| 层 | 技术选型 | 决策理由 |
|---|---|---|
| 前端框架 | Next.js 15 + Tailwind CSS 4 | 沿用现有技术栈，降低迁移成本 |
| UI 组件库 | shadcn/ui（基于 Radix UI + Tailwind） | V1 开发速度最快，组件专业美观 |
| 数据库 | PostgreSQL + Prisma ORM | V1 换库成本最低，V2 多租户扩展顺畅 |
| 任务队列 | BullMQ + Redis | 成熟稳定，异步导入流水线标配 |
| AI 层 | 抽象 AI Provider 接口，V1 接入 DashScope（qwen-plus） | 模型可替换，后续扩展 Claude/DeepSeek 成本低 |
| 多租户 | Organization 完全数据隔离 | V1 直接多租户，架构一步到位 |
| 架构模式 | 分阶段逐步构建 | 子系统有依赖关系，并行开工风险高 |

---

## 三、数据模型

### 3.1 实体关系

```
Organization (租户)
  ├── User (成员)
  ├── RuleVersion (规则版本)
  ├── QuoteVersion (报价版本)
  ├── ImportJob (导入任务)
  └── AuditLog (操作日志)

ImportJob
  └── ImportBlock[] (文件切片)
        └── ParseIssue[] (置信度问题)

RuleVersion
  └── Rule[] (规则 DSL 记录)

QuoteVersion
  ├── Quote[] (渠道报价)
  ├── Surcharge[] (附加费)
  ├── BillingRule[] (计费规则)
  └── Restriction[] (限制规则)
```

### 3.2 数据表设计

#### organizations（租户）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| name | VARCHAR(255) | 组织名称 |
| plan | VARCHAR(50) | free/pro/enterprise |
| created_at | TIMESTAMP | 创建时间 |

#### users（成员）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| email | VARCHAR(255) | 登录邮箱 |
| name | VARCHAR(255) | 姓名 |
| role | ENUM | owner/admin/member/viewer |
| created_at | TIMESTAMP | 创建时间 |

#### import_jobs（导入任务）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| filename | VARCHAR(255) | 文件名 |
| status | ENUM | pending/processing/completed/failed |
| upstream | VARCHAR(255) | 上游名称 |
| checksum | VARCHAR(64) | 文件 MD5 |
| uploaded_by | UUID | 上传用户 |
| error_message | TEXT | 失败原因 |
| created_at | TIMESTAMP | 创建时间 |
| completed_at | TIMESTAMP | 完成时间 |

#### import_blocks（文件切片）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| import_job_id | UUID | 关联任务 |
| block_type | ENUM | pricing/restriction/surcharge/notes/clause |
| sheet_name | VARCHAR(255) | 来源 Sheet |
| row_range | VARCHAR(50) | 行范围，如 "5-20" |
| raw_text | TEXT | 原始文本 |
| normalized_text | TEXT | 归一化后文本 |
| confidence | INTEGER | 置信度 0-100 |
| needs_review | BOOLEAN | 是否需人工审核 |

#### parse_issues（置信度问题）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| import_block_id | UUID | 关联切片 |
| issue_type | ENUM | unclear_header/cross_sheet/conflict/missing_field/ambiguous_condition |
| raw_segment | TEXT | 原文片段 |
| ai_extraction | JSONB | AI 提取结果 |
| reason | TEXT | 系统判低置信度原因 |
| suggested_fix | TEXT | 建议修正项 |
| resolved_by | UUID | 审核用户 |
| resolved_at | TIMESTAMP | 审核时间 |

#### mapping_dictionaries（标准字典）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| category | ENUM | country/channel/transport_type/cargo_type/unit/currency/zone |
| normalized_value | VARCHAR(255) | 标准值 |
| aliases | JSONB | 同义词数组，如 ["US Line", "美线普货"] |
| created_at | TIMESTAMP | 创建时间 |

#### rule_versions（规则版本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| upstream | VARCHAR(255) | 上游名称 |
| version | INTEGER | 版本号，自增 |
| status | ENUM | draft/published/archived |
| published_by | UUID | 发布用户 |
| created_at | TIMESTAMP | 创建时间 |
| published_at | TIMESTAMP | 发布时间 |

#### rules（规则 DSL）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织（通过 rule_version 继承，直接存冗余字段用于行级安全过滤） |
| rule_version_id | UUID | 关联版本 |
| category | ENUM | surcharge/restriction/compensation/billing |
| type | VARCHAR(100) | 规则类型，如 "偏远"/"超尺寸"/"品类" |
| item_type | JSONB | 适用品类数组，如 ["电池", "液体"]，单品类附加费时为单元素数组 |
| charge_type | ENUM | per_kg/per_item/fixed |
| charge_value | DECIMAL(10,2) | 收费金额 |
| condition | TEXT | 触发条件（自然语言） |
| description | TEXT | 规则描述 |
| content | TEXT | 完整规则内容 |
| priority | INTEGER | 优先级（数字越小越高） |
| confidence | ENUM | high/medium/low |
| source | ENUM | ai/manual |
| raw_evidence | TEXT | 原文证据（来源文件 + Sheet + 行号） |
| created_at | TIMESTAMP | 创建时间 |

#### quote_versions（报价版本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| rule_version_id | UUID | 关联规则版本 |
| upstream | VARCHAR(255) | 上游名称 |
| version | INTEGER | 版本号 |
| status | ENUM | draft/published/archived |
| created_at | TIMESTAMP | 创建时间 |
| published_at | TIMESTAMP | 发布时间 |

#### quotes（渠道报价）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| quote_version_id | UUID | 关联版本 |
| country | VARCHAR(100) | 国家 |
| transport_type | VARCHAR(50) | 运输类型 |
| cargo_type | VARCHAR(50) | 货物类型 |
| channel_name | VARCHAR(255) | 渠道名称 |
| zone | VARCHAR(100) | 分区 |
| postcode_min | VARCHAR(50) | 邮编最小值 |
| postcode_max | VARCHAR(50) | 邮编最大值 |
| weight_min | DECIMAL(10,2) | 重量最小值 |
| weight_max | DECIMAL(10,2) | 重量最大值 |
| unit_price | DECIMAL(10,4) | 单价 |
| time_estimate | VARCHAR(100) | 时效 |
| raw_text | TEXT | 原文 |

#### surcharges（附加费）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| rule_version_id | UUID | 关联版本 |
| category | ENUM | remote/oversize/overweight/item_type/private_address/other |
| charge_type | ENUM | per_kg/per_item/fixed |
| charge_value | DECIMAL(10,2) | 收费金额 |
| condition | TEXT | 触发条件 |
| raw_evidence | TEXT | 原文证据 |

#### billing_rules（计费规则）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| rule_version_id | UUID | 关联版本 |
| rule_type | VARCHAR(100) | 规则类型 |
| rule_key | VARCHAR(100) | 规则键名 |
| rule_value | TEXT | 规则值 |
| raw_evidence | TEXT | 原文证据 |

#### restrictions（限制规则）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| rule_version_id | UUID | 关联版本 |
| type | ENUM | category/size/area |
| content | TEXT | 限制内容 |
| raw_evidence | TEXT | 原文证据 |

#### audit_logs（操作日志）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| organization_id | UUID | 关联组织 |
| user_id | UUID | 操作用户 |
| action | VARCHAR(100) | 操作类型 |
| entity_type | VARCHAR(100) | 实体类型 |
| entity_id | UUID | 实体 ID |
| before | JSONB | 变更前内容 |
| after | JSONB | 变更后内容 |
| ip | VARCHAR(50) | IP 地址 |
| created_at | TIMESTAMP | 操作时间 |

---

## 四、API 设计

### 4.1 REST API 结构

```
认证
POST   /api/auth/login                登录
POST   /api/auth/logout               登出

组织 & 成员
GET    /api/organizations/:id                   获取组织信息
PUT    /api/organizations/:id                   更新组织
GET    /api/organizations/:id/members            成员列表
POST   /api/organizations/:id/members            添加成员
PUT    /api/organizations/:id/members/:userId    更新成员角色
DELETE /api/organizations/:id/members/:userId    移除成员

导入任务
POST   /api/import-jobs                    创建导入任务（上传文件）
GET    /api/import-jobs                    列表（分页 + 筛选）
GET    /api/import-jobs/:id                详情
GET    /api/import-jobs/:id/blocks         获取切片列表
GET    /api/import-jobs/:id/issues         获取置信度问题列表
POST   /api/import-jobs/:id/retry          重试失败任务

审核队列
GET    /api/review/issues                  低置信度问题列表
POST   /api/review/issues/:id/resolve       人工确认/修正

字典管理
GET    /api/dictionaries                   字典列表（按 category 筛选）
POST   /api/dictionaries                   添加映射
PUT    /api/dictionaries/:id               更新映射
DELETE /api/dictionaries/:id               删除映射
POST   /api/dictionaries/normalize          文本归一化接口（给导入流程调用）

规则版本
GET    /api/rule-versions                   版本列表
POST   /api/rule-versions                   创建新版本（草稿）
GET    /api/rule-versions/:id               版本详情
PUT    /api/rule-versions/:id               更新版本
POST   /api/rule-versions/:id/publish        发布版本
POST   /api/rule-versions/:id/rollback       回滚到指定版本
GET    /api/rule-versions/:id/diff           与另一版本对比差异

规则
GET    /api/rules                           规则列表（按 version/category/type 筛选）
POST   /api/rules                           手动创建规则
PUT    /api/rules/:id                       更新规则
DELETE /api/rules/:id                       删除规则
POST   /api/rules/bulk-import               批量导入规则（从已审阅的 blocks）

报价版本
GET    /api/quote-versions                   报价版本列表
POST   /api/quote-versions                   创建报价版本（关联 rule-version）
GET    /api/quote-versions/:id              版本详情
POST   /api/quote-versions/:id/publish       发布报价版本
POST   /api/quote-versions/:id/rollback      回滚

报价计算
POST   /api/quotes/calculate                询价（返回可解释报价）

审计日志
GET    /api/audit-logs                      操作日志（分页 + 筛选）
```

### 4.2 关键 API 行为

**POST /api/import-jobs（异步导入）**
1. 验证文件格式（xlsx/xls）
2. 生成 job_id，存入 PostgreSQL（status=pending）
3. 文件存至 /data/uploads/{job_id}.xlsx
4. BullMQ 入队 parse-excel 任务
5. 返回 `{ job_id }`，前端轮询状态

**POST /api/quotes/calculate（可解释报价）**
响应包含：基础报价明细、附加费列表（含原文证据和命中原因）、未命中规则（含原因）、总价、规则版本 ID。

---

## 五、前端页面结构

```
/login                          登录页
/dashboard                      控制台首页

/import-jobs                    导入任务中心
  ├── /import-jobs/new          上传文件 + 选择上游
  └── /import-jobs/[id]        任务详情（blocks / issues / preview 标签页）

/review                         审核队列首页
  └── /review/[issueId]         单个问题审核页

/dictionaries                   字典管理（按 category 子路由）

/rules
  ├── /rules/versions           版本列表
  ├── /rules/versions/[id]      版本详情 + 规则列表
  └── /rules/versions/[id]/diff 与其他版本对比

/quotes
  ├── /quotes/versions          报价版本列表
  ├── /quotes/versions/[id]    版本详情 + 渠道列表
  └── /quotes/calculate        询价页（可解释结果）

/team
  ├── /team/members            成员列表 + 角色
  └── /team/invite             邀请成员

/settings                       设置（个人 / 组织 / API Key）

/audit-logs                     操作审计日志
```

### 审核队列核心交互

审核页面只展示四要素：
1. **原文片段** — Excel 原始文本
2. **AI 提取结果** — 系统提取的字段值
3. **判低置信度原因** — issue_type 对应的原因说明
4. **建议修正项** — 系统给出的修正建议

用户操作：接受 AI 结果 / 修改字段值 / 标记为无法解析。

---

## 六、导入异步流水线

### 流程概览

```
用户上传文件 → POST /api/import-jobs
  → 创建 import_job (status=pending)
  → BullMQ 入队 parse-excel
  → 返回 job_id（前端轮询）

BullMQ Worker 流水线：
Step 1: 切块 parse-excel
  读取所有 sheet，分类为 pricing/surcharges/restrictions/notes/clause
  每块记录 sheet_name + row_range + raw_text

Step 2: 归一化 normalize-blocks
  调用字典接口归一化国家/渠道/运输类型/货物类型
  识别计费单位（kg/千克 → 标准单位）

Step 3: AI 提取 extract-rules
  按 block_type 构造 prompt，调用 AI Provider 接口
  解析返回，构造 Rule DSL 对象

Step 4: 置信度评分 score-confidence
  5项评分，每项 0-25分，总分 0-100
  80-100: high → 自动通过
  50-79: medium → 需人工审核
  0-49: low → 标记待处理

Step 5: 入库 persist-rules
  high → 直接写入 rules 表
  medium/low → 写入 parse_issues
  更新 import_job.status = 'completed'
```

### 置信度评分规则

| 维度 | 满分条件 | 降分条件 |
|---|---|---|
| 表头清晰度 | 表头行含明确字段名 | 含额外修饰词（如"含税"） |
| 数据完整性 | 必填字段 100% | 缺 1 个扣 10 分，缺 2+ 扣 25 分 |
| 条件明确性 | 条件无歧义 | 跨 sheet 引用，语义含糊 |
| 数值合理性 | 单价/重量在合理范围 | 明显异常 |
| 版本一致性 | 与上一版本无冲突 | 与旧版本冲突 |

### 审核 → 规则晋升流程

当用户通过 `POST /api/review/issues/:id/resolve` 审核一项 `parse_issue` 后：

1. 更新 `parse_issues.resolved_by` 和 `resolved_at`
2. 根据审核结果（接受 AI 提取 / 修正字段值 / 标记无法解析）：
   - **接受或修正**：将规则写入 `rules` 表（source=manual，confidence=high），同时更新对应 `import_block.confidence=100`，`needs_review=false`
   - **无法解析**：标记 `parse_issues` 为无法解析，该块数据不进入规则 DSL
3. 关联的 `rule_version` 保持 draft 状态，直到发布时整批确认

---

## 七、报价引擎可解释模式

### 输入字段
- country, transport_type, cargo_type
- actual_weight, volume_weight, chargeable_weight
- dimensions: { L, W, H }
- postcode, item_types[], is_private_address

### 计算流程
1. 加载已发布的 quote_version（关联当前 rule_version）
2. 查询匹配渠道：country + transport_type + cargo_type + weight_range + postcode_range
3. 计算基础报价：chargeable_weight × unit_price
4. 枚举 surcharge 规则，逐条判断是否命中：
   - 偏远附加费（remote）：postcode 匹配偏远分区
   - 超尺寸附加费（oversize）：L/W/H 任一超阈值
   - 超重附加费（overweight）：actual_weight 超阈值
   - 品类附加费（item_type）：item_types[] 与规则的 item_type JSONB 数组交集非空
   - 私人地址附加费（private_address）：is_private_address=true
   - 其他（other）
5. 枚举 billing_rules，应用计费规则
6. 计算总价，返回可解释结果

### 响应结构（核心字段）
```json
{
  "quote": { "base_price": 150.00, "chargeable_weight": 15, "matched_channel": {...} },
  "surcharges": [
    {
      "type": "偏远",
      "amount": 20.00,
      "rule_id": "xxx",
      "raw_evidence": "阿拉斯加邮编加收20元（上A_v3, S2）",
      "hit_reason": "邮编 995 匹配偏远邮编段 995-999"
    }
  ],
  "unmatched_surcharges": [
    { "type": "超重", "reason": "实际重量15kg未达到超重阈值20kg" }
  ],
  "total": 185.00,
  "rule_version_id": "rv_xxx",
  "quote_version_id": "qv_xxx"
}
```

---

## 八、版本管理机制

### 规则版本生命周期

```
上传新 Excel → 创建 rule_version (status=draft)
    ↓
AI 自动提取 → 写入 draft 版本
    ↓
人工审核低置信度项 → 确认后写入 draft
    ↓
预览确认 → 发布 (status=published)
    ↓
已发布版本不可修改，只可回滚
    ↓
旧版本自动归档 (status=archived)
```

### 版本对比（diff）API 返回结构
```json
{
  "added": [...],
  "removed": [...],
  "changed": [{ "rule_id": "xxx", "before": {...}, "after": {...} }],
  "unchanged": [...]
}
```

---

## 九、权限模型

| 操作 | owner | admin | member | viewer |
|---|---|---|---|---|
| 管理成员 | ✅ | ✅ | ❌ | ❌ |
| 上传 Excel | ✅ | ✅ | ✅ | ❌ |
| 审核规则 | ✅ | ✅ | ✅ | ❌ |
| 发布版本 | ✅ | ✅ | ❌ | ❌ |
| 询价查询 | ✅ | ✅ | ✅ | ✅ |
| 查看日志 | ✅ | ✅ | ✅ | ✅ |

---

## 十、非功能性设计

### 性能目标
- 报价计算响应时间 < 200ms
- Excel 切片 + AI 提取总耗时 < 60s（单文件）
- 支持并发导入任务数 ≥ 10

### 安全设计
- JWT 认证，令牌有效期 7 天
- 行级数据隔离（Prisma middleware 强制 organization_id 过滤）
- 敏感操作（发布版本/删除规则）记录审计日志
- API Key 仅管理员可配置

### 可扩展性
- AI Provider 抽象层：后续可接入 Claude、DeepSeek 等模型，按任务类型路由
- 字典系统：支持动态扩展新 category，无需改代码
- 规则 DSL：支持未来新增规则类型（如燃油附加费、汇率调整）

---

## 十一、优先级

### V1 核心（8-10 周）
1. 项目初始化：Next.js 15 重构 + PostgreSQL + Prisma + Redis + BullMQ
2. 数据模型迁移：所有表从 SQLite Schema 迁移到 PostgreSQL + Prisma
3. 认证 & 多租户：JWT 认证 + Organization 隔离
4. 导入任务中心：异步流水线 + 切块 + 置信度评分
5. 规则审核队列：低置信度问题展示 + 人工审核交互
6. 标准字典系统：category CRUD + normalize 接口
7. 规则 DSL：统一规则结构 + AI 提取改造
8. 报价引擎可解释模式：calculate API + 响应结构重构
9. 版本管理：rule_versions + quote_versions + diff + rollback
10. 团队成员 + 角色权限
11. 操作日志

### V2 扩展（后续）
- 组织/多租户增强（子账号、权限细化）
- 审计日志增强（导出、对账）
- API 开放（对外报价 API）
- 客户报价门户

### V3 生态（更远）
- 客户自助报价门户
- 销售 CRM / 线索管理
- 微信/企业微信通知集成
