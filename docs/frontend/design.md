# 前端设计方案（对接真实后端）

## 1. 目标

在保留你现有视觉和页面结构的前提下，把目前 `mock + timer` 驱动改造成：

- 首屏真实数据加载
- 行情/日志/指标实时更新
- 引擎控制、策略配置、风控阈值可写
- 可观测异常态（断连、接口失败、风控触发）

## 2. 页面域模型

### 2.1 Dashboard

展示：
- lifetime / weekly profit
- 50天累计收益曲线
- recent fills

依赖：
- `GET /dashboard/summary`
- `GET /dashboard/profit-curve?days=50`
- WS `fills.recent`

### 2.2 Portfolio

展示：
- 资金分配（pie）
- 活跃仓位表

依赖：
- `GET /portfolio/summary`
- `GET /portfolio/positions`
- WS `portfolio.positions`

### 2.3 Live Markets

展示：
- 市场列表（搜索 + 策略筛选）
- Yes/No 价格变化
- 套利 spread 提示

依赖：
- `GET /markets`
- WS `markets.ticker`

### 2.4 System Health

展示：
- CPU / 内存 / API 延迟
- 实时折线图

依赖：
- `GET /system/metrics?window=5m`
- WS `system.metrics`

### 2.5 Logs

展示：
- 实时日志尾流

依赖：
- `GET /system/logs?limit=200`
- WS `system.logs`

### 2.6 Settings / Risk

展示：
- 策略开关、风险阈值、凭证状态

依赖：
- `GET /strategies`
- `PUT /strategies/:strategyName/config`
- `GET /risk/rules`
- `PUT /risk/rules`
- `PUT /settings/credentials/polymarket`

## 3. 交互状态设计

- `isRunning`：改为后端引擎真实状态（`GET /engine/state` + WS `engine.state`）
- `logs`：先加载历史，再增量 append
- `liveMarkets`：首屏快照 + WS patch
- `systemMetrics`：固定窗口 ring buffer（例如 300 点）
- `positions`：以 `position.id` 做稳定 key 增量更新

## 4. 异常与降级

- REST 失败：展示错误卡片 + 可重试按钮
- WS 断开：顶部状态改为 `Reconnecting...`，并自动指数退避重连
- 重连期间：启用轮询（5~10s）保持页面可用
- 风控触发：在 Header 和 Risks Tab 显示高优先级告警

## 5. 前端信息架构建议（不改视觉）

- 新增全局 `ConnectionBadge`：显示 `REST OK / WS OK / Latency`
- 新增全局 `RiskBanner`：触发风控时固定在顶部
- Settings 中将“API Credentials”改为“已配置/未配置”状态，不回显敏感信息

## 6. 可测试性

- 将页面数据请求从组件内抽离到 `services/api.ts`
- 用 `adapters` 将后端 DTO 映射为页面 ViewModel
- 对关键计算（如套利检测）做纯函数单测
