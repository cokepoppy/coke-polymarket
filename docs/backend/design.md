# 后端设计方案（基于现有前端页面）

## 1. 目标与范围

目标：在不改动你现有前端信息架构（Dashboard/Portfolio/Markets/Strategies/Health/Logs/Risks/Settings）的前提下，设计一套可上线的后端，支持：

- 实时市场数据聚合与展示
- 策略执行（可先从仿真/纸面交易开始，再切到真实交易）
- 订单执行、仓位与 PnL 统计
- 风控、系统日志、运行状态控制（Start/Stop/Kill Switch）

非目标（第一阶段不做）：

- 高频撮合级超低延迟优化（纳秒级）
- 多交易所统一接入
- 复杂机器学习训练平台

## 2. 架构原则

- 单体优先（Modular Monolith）：先用一个 Express 服务拆模块，降低复杂度。
- 读写分离：行情为高频读，交易与配置为强一致写。
- 事件驱动：策略、风控、执行通过内部事件总线解耦。
- 先可观测后自动化：每个动作可追踪（日志、指标、审计记录）。
- 安全默认：密钥不明文落库，敏感配置最小暴露。

## 3. 业务域拆分

### 3.1 Market Data 域

职责：
- 连接 Polymarket 的市场数据接口（Gamma/Data API + CLOB WS）
- 统一行情快照、盘口、成交流格式
- 向前端推送标准化行情流

输入：外部 API / WebSocket
输出：`market_snapshots`、`orderbook_snapshots`、WS 推送事件

### 3.2 Strategy 域

职责：
- 维护策略配置（Arbitrage / Price Dislocation / Market Making）
- 周期性扫描市场，生成交易信号
- 记录信号与执行结果，用于回放和归因

输入：市场快照、风险参数
输出：`strategy_signals`、下单请求事件

### 3.3 Execution 域

职责：
- 统一下单、撤单、补单逻辑
- 处理订单状态机（NEW/PARTIAL/FILLED/CANCELED/REJECTED）
- 维护成交明细和持仓

输入：策略信号、人工操作（Start/Stop/Kill）
输出：`orders`、`fills`、`positions`

### 3.4 Risk 域

职责：
- 账户级风控（最大回撤、单市场敞口、单笔限额、速率限制）
- 交易前检查（pre-trade guard）
- 触发熔断和 Kill Switch

输入：仓位、PnL、配置阈值
输出：`risk_events`、引擎控制事件

### 3.5 Portfolio & Analytics 域

职责：
- 汇总净值、未实现/已实现收益
- 生成 Dashboard 曲线数据（50日累计收益）
- 计算策略贡献度与仓位分布

输入：fills、positions、market price
输出：`pnl_daily`、`portfolio_snapshots`

### 3.6 Ops & Observability 域

职责：
- 系统日志和审计
- CPU/内存/延迟等运行指标
- 健康检查与告警

输入：应用内部事件
输出：`system_metrics`、`system_logs`

## 4. 前端页面到后端能力映射

| 前端 Tab | 后端能力 | 数据来源 | 推送方式 |
|---|---|---|---|
| Dashboard | 总收益、周收益、成交列表、收益曲线 | `pnl_daily` + `fills` | REST + WS |
| Portfolio | 仓位列表、资金分配 | `positions` + `portfolio_snapshots` | REST + WS |
| Live Markets | 市场列表、Yes/No、套利识别 | `market_snapshots` | WS 主导 |
| Strategies | 策略状态与说明 | `strategy_configs` + `strategy_runs` | REST |
| Health | CPU/内存/延迟 | `system_metrics` | WS |
| Logs | 实时日志流 | `system_logs` | WS |
| Risks | 风险事件和阈值 | `risk_rules` + `risk_events` | REST + WS |
| Settings | 参数与凭证配置 | `strategy_configs` + `api_credentials` | REST |

## 5. 关键状态机

### 5.1 Bot 引擎状态

`STOPPED -> STARTING -> RUNNING -> DEGRADING -> STOPPING -> STOPPED`

- `KILL_SWITCH` 可从任意状态跳转到 `STOPPING`
- `DEGRADING` 表示数据源异常或风控限制触发，自动降载

### 5.2 订单状态

`CREATED -> SENT -> ACKED -> PARTIALLY_FILLED -> FILLED`

异常分支：
- `ACKED -> CANCELED`
- `SENT/ACKED -> REJECTED`
- 任意状态超时进入 `EXPIRED`

## 6. 风控设计（最小可用）

- 单市场最大名义仓位：`max_position_usdc`
- 全局最大回撤：`global_stop_loss_pct`
- 单分钟最大下单次数：`max_orders_per_min`
- 单日最大亏损：`daily_loss_limit`

触发后动作：
1. 拒绝新单
2. 自动撤掉做市挂单
3. 记录 `risk_events`
4. 发送前端告警并切换引擎状态

## 7. 部署拓扑（第一阶段）

- `frontend`（Vite/静态托管）
- `api`（Express + TS）
- `mysql`（Docker 容器）

说明：
- 后续如果行情吞吐变大，再增加 `redis` 作为事件总线/缓存。
- 第一阶段使用单实例 API 足够，先保证正确性和审计能力。

## 8. 调研结论（与实现相关）

- Polymarket 官方对外有 Gamma/Data API、CLOB REST、CLOB WebSocket 三类接口，建议市场发现走 Data/Gamma，交易与深度走 CLOB。
- CLOB 鉴权分 L1/L2，两层签名流程需要在后端安全封装，前端不直接接触交易签名细节。
- 官方文档在 2025 年 9 月有 WebSocket 消息结构更新，消息解析必须做版本兼容和 schema 校验。

## 9. 里程碑建议

1. M1（1 周）：只接行情 + 仿真撮合 + 前端联调（不实盘）
2. M2（1~2 周）：接入真实下单、风控阈值、Kill Switch
3. M3（1 周）：监控告警、回放审计、灰度上线
