# 前端技术方案（对接 Express 后端）

## 1. 改造原则

- UI 不重写，只替换数据源。
- 先通只读链路，再接写操作。
- 所有接口定义强类型化，避免“any 传染”。

## 2. 推荐前端目录增量

```txt
src/
  api/
    client.ts           # fetch 封装、鉴权、错误处理
    dashboard.ts
    markets.ts
    portfolio.ts
    strategy.ts
    system.ts
  ws/
    socket.ts           # WS 连接管理、重连、心跳
    channels.ts         # channel -> handler
  store/
    app.store.ts        # 可用 Zustand / Redux Toolkit
  models/
    dto.ts              # 后端 DTO
    view-model.ts       # 页面模型
  hooks/
    useEngineState.ts
    useMarketStream.ts
    useSystemMetrics.ts
```

## 3. 类型契约示例

```ts
export interface MarketTickerDTO {
  marketId: string;
  name: string;
  yes: string; // decimal string
  no: string;
  volume24h: string;
  liquidity: string;
  strategyTag: 'Arbitrage' | 'Price Dislocation' | 'Market Maker';
  ts: number;
}

export interface WsEnvelope<T> {
  channel: string;
  ts: number;
  data: T;
}
```

## 4. 数据流模式

1. 页面加载：并行请求 REST 快照（summary/markets/positions/logs）
2. 快照完成：建立 WS 订阅
3. 增量更新：按 `marketId` / `positionId` patch 本地状态
4. 断连降级：切换到轮询并重连 WS

## 5. 写操作流程

### 5.1 引擎控制

- 点击 `Start Engine` -> `POST /engine/start`
- 乐观更新按钮状态为 `STARTING`
- 等 `engine.state` 确认后转 `RUNNING`

### 5.2 设置保存

- 先前端 schema 校验（zod）
- `PUT /strategies/:name/config` / `PUT /risk/rules`
- 成功后 toast + 局部刷新

## 6. 错误处理规范

- API 统一错误对象：`{ code, message, details, traceId }`
- 前端按 `code` 分类：
  - `RISK_BLOCKED`：高优先级红色告警
  - `AUTH_REQUIRED`：跳转登录/重新鉴权
  - `UPSTREAM_TIMEOUT`：提示稍后重试

## 7. 性能与体验

- 市场列表采用虚拟滚动（市场数 > 200 时）
- 高频 WS 更新节流到 100~250ms 批量提交
- 图表仅保留固定窗口点位（避免内存增长）

## 8. 联调清单

- [ ] Dashboard 三个接口返回结构与页面字段一致
- [ ] Markets 在 WS 高频更新下无明显卡顿
- [ ] Kill Switch 能在 1s 内反映到 UI 状态
- [ ] 风控触发时前端有显式告警，不静默失败
- [ ] Settings 不回显任何敏感凭证明文

## 9. 与当前代码的最小改动路径

- 删除 `App.tsx` 中 4 组 `setInterval` 模拟逻辑
- 保留组件结构，把状态来源改为 `store + api/ws`
- 保留现有图表组件，只替换数据绑定字段
