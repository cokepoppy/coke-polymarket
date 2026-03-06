import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  TrendingUp,
  Zap,
  Clock,
  Scale,
  Terminal,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Cpu,
  Server,
  DollarSign,
  Play,
  Square,
  Wifi,
  PieChart as PieChartIcon,
  Sliders,
  HardDrive,
  Network,
  CheckCircle2,
  ArrowRightLeft,
  Wallet,
  Search,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

type EngineState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'DEGRADING' | 'STOPPING';
type StrategyTag = 'Arbitrage' | 'Price Dislocation' | 'Market Maker';
type Side = 'Yes' | 'No';

type Market = {
  id: string;
  name: string;
  yes: number;
  no: number;
  prevYes: number;
  prevNo: number;
  volume: number;
  liquidity: number;
  strategy: StrategyTag;
  updatedAt: number;
};

type Fill = {
  id: string;
  time: string;
  marketId: string;
  market: string;
  side: Side;
  price: number;
  size: number;
  fee: number;
  ts: number;
};

type Position = {
  id: string;
  marketId: string;
  market: string;
  side: Side;
  size: number;
  entry: number;
  current: number;
  pnl: number;
  realizedPnl: number;
  updatedAt: number;
};

type ProfitPoint = { day: string; profit: number };
type PortfolioAllocation = { name: string; value: number };

type StrategyConfig = {
  name: StrategyTag;
  enabled: boolean;
  description: string;
  params: Record<string, unknown>;
  updatedAt: number;
};

type RiskRule = {
  name: 'max_position_usdc' | 'global_stop_loss_pct' | 'max_orders_per_min' | 'daily_loss_limit';
  value: number;
  enabled: boolean;
  updatedAt: number;
};

type RiskEvent = {
  id: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  context: Record<string, unknown>;
  createdAt: number;
};

type SystemMetric = {
  ts: number;
  cpu: number;
  memoryMb: number;
  latency: number;
};

type SystemLog = {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: 'SYSTEM' | 'STRATEGY' | 'EXECUTE' | 'RISK';
  message: string;
  ts: number;
};

type CredentialStatus = {
  provider: 'polymarket';
  configured: boolean;
  updatedAt?: number;
};

type PaperTradingStatus = {
  mode: 'paper';
  liveDataConnected: boolean;
  lastSyncAt: number | null;
  lastLatencyMs: number | null;
  source: 'gamma-api' | 'seed';
  marketCount: number;
  cashBalance: number;
  startingCash: number;
  totalEquity: number;
};

type TradingStatus = {
  configured: boolean;
  hasCredentials: boolean;
  hasPrivateKey: boolean;
  hasFunderAddress: boolean;
  canTrade: boolean;
  host: string;
  chainId: number;
  signatureType: number;
  paperTrading: PaperTradingStatus;
};

type DashboardSummary = {
  totalProfit: number;
  weeklyProfit: number;
  winRate: number;
  sharpeRatio: number;
  openPnl: number;
  tradesToday: number;
  engineState: EngineState;
  updatedAt: number;
};

type WsEnvelope = {
  channel: string;
  ts: number;
  data: unknown;
};

const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

const fallbackMarkets: Market[] = [
  {
    id: 'mkt-btc-100k-mar',
    name: 'Will BTC hit $100k in March?',
    yes: 0.45,
    no: 0.53,
    prevYes: 0.45,
    prevNo: 0.53,
    volume: 1200000,
    liquidity: 450000,
    strategy: 'Arbitrage',
    updatedAt: Date.now(),
  },
  {
    id: 'mkt-eth-15m-up',
    name: 'ETH 15m Price Up?',
    yes: 0.82,
    no: 0.16,
    prevYes: 0.82,
    prevNo: 0.16,
    volume: 450000,
    liquidity: 120000,
    strategy: 'Price Dislocation',
    updatedAt: Date.now(),
  },
  {
    id: 'mkt-fed-cut-jun',
    name: 'Fed Rate Cut in June?',
    yes: 0.31,
    no: 0.68,
    prevYes: 0.31,
    prevNo: 0.68,
    volume: 3500000,
    liquidity: 1100000,
    strategy: 'Market Maker',
    updatedAt: Date.now(),
  },
];

const fallbackLogs: SystemLog[] = [
  {
    id: 'log-init-1',
    time: '10:42:01',
    level: 'INFO',
    category: 'SYSTEM',
    message: 'Connected to Polymarket API Node (Latency: 12ms)',
    ts: Date.now(),
  },
  {
    id: 'log-init-2',
    time: '10:42:05',
    level: 'INFO',
    category: 'STRATEGY',
    message: 'Scanning for Math Parity Arbitrage opportunities...',
    ts: Date.now(),
  },
];

const fallbackSummary: DashboardSummary = {
  totalProfit: 1720000,
  weeklyProfit: 115420,
  winRate: 68.4,
  sharpeRatio: 3.2,
  openPnl: 560,
  tradesToday: 142,
  engineState: 'RUNNING',
  updatedAt: Date.now(),
};

const fallbackCurve: ProfitPoint[] = Array.from({ length: 50 }, (_, i) => ({
  day: `Day ${i + 1}`,
  profit: Math.floor(Math.random() * 5000) + i * 2000 + 10000,
}));

const fallbackPositions: Position[] = [
  {
    id: 'pos1',
    marketId: 'mkt-btc-100k-mar',
    market: 'BTC 100k March',
    side: 'Yes',
    size: 5000,
    entry: 0.42,
    current: 0.45,
    pnl: 150,
    realizedPnl: 0,
    updatedAt: Date.now(),
  },
  {
    id: 'pos2',
    marketId: 'mkt-fed-cut-jun',
    market: 'Fed Rate Cut',
    side: 'No',
    size: 12000,
    entry: 0.65,
    current: 0.68,
    pnl: 360,
    realizedPnl: 0,
    updatedAt: Date.now(),
  },
];

const fallbackAllocation: PortfolioAllocation[] = [
  { name: 'USDC (Idle)', value: 4500 },
  { name: 'Active Arbitrage', value: 5200 },
  { name: 'Market Making', value: 2750 },
];

const fallbackStrategies: StrategyConfig[] = [
  {
    name: 'Arbitrage',
    enabled: true,
    description: 'Exploit Yes+No < 1.00 opportunities.',
    params: { minSpread: 0.003 },
    updatedAt: Date.now(),
  },
  {
    name: 'Price Dislocation',
    enabled: true,
    description: 'Capture short-term dislocations.',
    params: { triggerBps: 35 },
    updatedAt: Date.now(),
  },
  {
    name: 'Market Maker',
    enabled: false,
    description: 'Provide two-sided quotes and earn spread.',
    params: { spreadBps: 25 },
    updatedAt: Date.now(),
  },
];

const fallbackRiskRules: RiskRule[] = [
  { name: 'max_position_usdc', value: 5000, enabled: true, updatedAt: Date.now() },
  { name: 'global_stop_loss_pct', value: 15, enabled: true, updatedAt: Date.now() },
  { name: 'max_orders_per_min', value: 180, enabled: true, updatedAt: Date.now() },
  { name: 'daily_loss_limit', value: 1000, enabled: true, updatedAt: Date.now() },
];

const fallbackMetrics: SystemMetric[] = Array.from({ length: 20 }, (_, i) => ({
  ts: Date.now() - (20 - i) * 1000,
  cpu: 45,
  memoryMb: 2400,
  latency: 12,
}));

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json?.error?.message ?? `Request failed: ${path}`);
  }

  return json.data as T;
}

function formatMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDateTime(value: number | null | undefined): string {
  if (!value) return 'Waiting for first sync';
  return new Date(value).toLocaleString();
}

function strategyTitle(tag: StrategyTag): string {
  if (tag === 'Arbitrage') return 'Math Parity Arbitrage';
  return tag;
}

function logType(log: SystemLog): 'INFO' | 'STRATEGY' | 'EXECUTE' | 'RISK' {
  if (log.category === 'EXECUTE') return 'EXECUTE';
  if (log.category === 'RISK') return 'RISK';
  if (log.category === 'STRATEGY') return 'STRATEGY';
  return 'INFO';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [engineState, setEngineState] = useState<EngineState>('RUNNING');
  const [wsConnected, setWsConnected] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>(fallbackSummary);
  const [profitData, setProfitData] = useState<ProfitPoint[]>(fallbackCurve);
  const [recentFills, setRecentFills] = useState<Fill[]>([]);

  const [liveMarkets, setLiveMarkets] = useState<Market[]>(fallbackMarkets);
  const [marketSearch, setMarketSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('All');

  const [portfolioAllocation, setPortfolioAllocation] = useState<PortfolioAllocation[]>(fallbackAllocation);
  const [portfolioExposure, setPortfolioExposure] = useState(19500);
  const [totalEquity, setTotalEquity] = useState(12450);
  const [positions, setPositions] = useState<Position[]>(fallbackPositions);

  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>(fallbackMetrics);
  const [logs, setLogs] = useState<SystemLog[]>(fallbackLogs);

  const [strategies, setStrategies] = useState<StrategyConfig[]>(fallbackStrategies);
  const [riskRules, setRiskRules] = useState<RiskRule[]>(fallbackRiskRules);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>({ provider: 'polymarket', configured: false });
  const [tradingStatus, setTradingStatus] = useState<TradingStatus | null>(null);
  const [keyIdInput, setKeyIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');

  const isRunning = engineState === 'RUNNING' || engineState === 'STARTING' || engineState === 'DEGRADING';

  const latestMetric = systemMetrics[systemMetrics.length - 1] ?? fallbackMetrics[0];

  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'portfolio', icon: PieChartIcon, label: 'Portfolio & Positions' },
    { id: 'markets', icon: Activity, label: 'Live Markets' },
    { id: 'strategies', icon: Zap, label: 'Strategies' },
    { id: 'health', icon: HardDrive, label: 'System Health' },
    { id: 'logs', icon: Terminal, label: 'System Logs' },
    { id: 'risks', icon: ShieldAlert, label: 'Risk Management' },
    { id: 'settings', icon: Sliders, label: 'Settings' },
  ];

  const filteredMarkets = useMemo(() => {
    return liveMarkets.filter((market) => {
      const matchesSearch = market.name.toLowerCase().includes(marketSearch.toLowerCase());
      const matchesStrategy = strategyFilter === 'All' || market.strategy === strategyFilter;
      return matchesSearch && matchesStrategy;
    });
  }, [liveMarkets, marketSearch, strategyFilter]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setApiError(null);

      const tasks = await Promise.allSettled([
        requestJson<DashboardSummary>('/dashboard/summary'),
        requestJson<ProfitPoint[]>('/dashboard/profit-curve?days=50'),
        requestJson<Fill[]>('/trades/fills?limit=15'),
        requestJson<{ totalEquity: number; exposure: number; allocation: PortfolioAllocation[] }>('/portfolio/summary'),
        requestJson<Position[]>('/portfolio/positions'),
        requestJson<{ items: Market[] }>('/markets?page=1&pageSize=100'),
        requestJson<StrategyConfig[]>('/strategies'),
        requestJson<RiskRule[]>('/risk/rules'),
        requestJson<RiskEvent[]>('/risk/events?limit=20'),
        requestJson<SystemMetric[]>('/system/metrics?window=5m'),
        requestJson<SystemLog[]>('/system/logs?limit=200'),
        requestJson<CredentialStatus>('/settings/credentials/polymarket'),
        requestJson<TradingStatus>('/trading/status'),
        requestJson<{ state: EngineState }>('/engine/state'),
      ]);

      if (!alive) return;

      const errors = tasks.filter((item) => item.status === 'rejected');
      if (errors.length > 0) {
        setApiError('Backend unavailable. Running in degraded/fallback mode.');
      }

      if (tasks[0].status === 'fulfilled') {
        setDashboardSummary(tasks[0].value);
      }
      if (tasks[1].status === 'fulfilled') {
        setProfitData(tasks[1].value);
      }
      if (tasks[2].status === 'fulfilled') {
        setRecentFills(tasks[2].value);
      }
      if (tasks[3].status === 'fulfilled') {
        setTotalEquity(tasks[3].value.totalEquity);
        setPortfolioExposure(tasks[3].value.exposure);
        setPortfolioAllocation(tasks[3].value.allocation);
      }
      if (tasks[4].status === 'fulfilled') {
        setPositions(tasks[4].value);
      }
      if (tasks[5].status === 'fulfilled') {
        setLiveMarkets(tasks[5].value.items);
      }
      if (tasks[6].status === 'fulfilled') {
        setStrategies(tasks[6].value);
      }
      if (tasks[7].status === 'fulfilled') {
        setRiskRules(tasks[7].value);
      }
      if (tasks[8].status === 'fulfilled') {
        setRiskEvents(tasks[8].value);
      }
      if (tasks[9].status === 'fulfilled') {
        setSystemMetrics(tasks[9].value);
      }
      if (tasks[10].status === 'fulfilled') {
        setLogs(tasks[10].value);
      }
      if (tasks[11].status === 'fulfilled') {
        setCredentialStatus(tasks[11].value);
      }
      if (tasks[12].status === 'fulfilled') {
        setTradingStatus(tasks[12].value);
      }
      if (tasks[13].status === 'fulfilled') {
        setEngineState(tasks[13].value.state);
      }
    }

    void bootstrap();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onclose = () => {
        setWsConnected(false);
        retryTimer = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        setWsConnected(false);
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as WsEnvelope;

        if (payload.channel === 'engine.state') {
          const state = (payload.data as { state?: EngineState }).state;
          if (state) setEngineState(state);
          return;
        }

        if (payload.channel === 'markets.ticker') {
          const raw = payload.data as Market[] | { items: Market[] };
          if (Array.isArray(raw)) {
            setLiveMarkets(raw);
          } else if (Array.isArray(raw.items)) {
            setLiveMarkets(raw.items);
          }
          return;
        }

        if (payload.channel === 'fills.recent') {
          const fill = payload.data as Fill;
          setRecentFills((prev) => [fill, ...prev].slice(0, 15));
          return;
        }

        if (payload.channel === 'portfolio.positions') {
          const pos = payload.data as Position[];
          if (Array.isArray(pos)) {
            setPositions(pos);
          }
          return;
        }

        if (payload.channel === 'system.metrics') {
          const metric = payload.data as SystemMetric;
          setSystemMetrics((prev) => [...prev.slice(-299), metric]);
          return;
        }

        if (payload.channel === 'system.logs') {
          const log = payload.data as SystemLog;
          setLogs((prev) => [log, ...prev].slice(0, 500));
          return;
        }

        if (payload.channel === 'risk.alerts') {
          const riskEvent = payload.data as RiskEvent;
          setRiskEvents((prev) => [riskEvent, ...prev].slice(0, 50));
          return;
        }

        if (payload.channel === 'strategies.updated') {
          const updated = payload.data as StrategyConfig;
          setStrategies((prev) => prev.map((item) => (item.name === updated.name ? updated : item)));
        }
      };
    };

    connect();

    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      socket?.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void requestJson<{ totalEquity: number; exposure: number; allocation: PortfolioAllocation[] }>('/portfolio/summary')
        .then((summary) => {
          setTotalEquity(summary.totalEquity);
          setPortfolioExposure(summary.exposure);
          setPortfolioAllocation(summary.allocation);
        })
        .catch(() => undefined);
    }, 15_000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleEngineToggle() {
    if (isRunning) {
      try {
        const data = await requestJson<{ state: EngineState }>('/engine/kill-switch', { method: 'POST' });
        setEngineState(data.state);
      } catch {
        setEngineState('STOPPED');
      }
      return;
    }

    try {
      const data = await requestJson<{ state: EngineState }>('/engine/start', { method: 'POST' });
      setEngineState(data.state);
    } catch {
      setEngineState('RUNNING');
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      await Promise.all(
        strategies.map((strategy) =>
          requestJson(`/strategies/${encodeURIComponent(strategy.name)}/config`, {
            method: 'PUT',
            body: JSON.stringify({ enabled: strategy.enabled, params: strategy.params }),
          }),
        ),
      );

      await requestJson('/risk/rules', {
        method: 'PUT',
        body: JSON.stringify(riskRules.map((rule) => ({ name: rule.name, value: rule.value, enabled: rule.enabled }))),
      });

      const hasCredentialInput =
        apiKeyInput.trim().length > 0 || secretInput.trim().length > 0 || passphraseInput.trim().length > 0;
      if (hasCredentialInput) {
        if (
          apiKeyInput.trim().length === 0 ||
          secretInput.trim().length === 0 ||
          passphraseInput.trim().length === 0
        ) {
          throw new Error('apiKey, secret, and passphrase must be provided together');
        }

        const credential = await requestJson<CredentialStatus>('/settings/credentials/polymarket', {
          method: 'PUT',
          body: JSON.stringify({
            keyId: keyIdInput || undefined,
            apiKey: apiKeyInput,
            secret: secretInput,
            passphrase: passphraseInput,
          }),
        });
        setCredentialStatus(credential);
        setApiKeyInput('');
        setSecretInput('');
        setPassphraseInput('');
      }

      const nextTradingStatus = await requestJson<TradingStatus>('/trading/status');
      setTradingStatus(nextTradingStatus);
    } catch {
      setApiError('Save failed. Please check backend connectivity and payload values.');
    } finally {
      setSettingsSaving(false);
    }
  }

  function updateStrategyEnabled(name: StrategyTag, enabled: boolean) {
    setStrategies((prev) => prev.map((strategy) => (strategy.name === name ? { ...strategy, enabled } : strategy)));
  }

  function updateRiskRule(name: RiskRule['name'], value: number) {
    setRiskRules((prev) => prev.map((rule) => (rule.name === name ? { ...rule, value } : rule)));
  }

  const maxPositionRule = riskRules.find((item) => item.name === 'max_position_usdc') ?? fallbackRiskRules[0];
  const stopLossRule = riskRules.find((item) => item.name === 'global_stop_loss_pct') ?? fallbackRiskRules[1];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30">
      <div className="flex h-screen overflow-hidden">
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col z-20">
          <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Cpu size={20} />
            </div>
            <div>
              <h1 className="font-bold text-zinc-100 tracking-tight">OpenClaw PolyMarket</h1>
              <p className="text-xs text-emerald-500 font-mono">gpt-5.4 high</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-zinc-800/80 text-emerald-400 shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <item.icon size={18} className={activeTab === item.id ? 'text-emerald-400' : ''} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-800 bg-zinc-950">
            <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Node Status</span>
                <span className="flex h-2 w-2 relative">
                  {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <Server size={14} />
                <span>{wsConnected ? 'Dedicated API Connected' : 'Realtime stream reconnecting...'}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-[#09090b] relative">
          <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-100 capitalize">{activeTab.replace('-', ' ')}</h2>
              <div className="h-4 w-px bg-zinc-800"></div>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-300 font-mono">{formatMoney(totalEquity)}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 text-xs font-mono mr-4">
                <div className={`flex items-center gap-1 ${dashboardSummary.openPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <TrendingUp size={14} /> {dashboardSummary.openPnl >= 0 ? '+' : ''}{formatMoney(dashboardSummary.openPnl)} Open
                </div>
                <div className="h-3 w-px bg-zinc-800"></div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <Activity size={14} /> {dashboardSummary.tradesToday} Trades
                </div>
              </div>
              <button
                onClick={() => void handleEngineToggle()}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  isRunning
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                }`}
              >
                {isRunning ? <Square size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                {isRunning ? 'Kill Switch' : 'Start Engine'}
              </button>
            </div>
          </header>

          <div className="p-8 max-w-7xl mx-auto">
            {apiError && (
              <div className="mb-6 border border-amber-800/40 bg-amber-500/10 rounded-lg px-4 py-3 text-sm text-amber-300">
                {apiError}
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total Profit (Lifetime)" value={formatMoney(dashboardSummary.totalProfit)} trend="Live" icon={DollarSign} trendUp={dashboardSummary.totalProfit >= 0} />
                  <StatCard title="Weekly Profit" value={formatMoney(dashboardSummary.weeklyProfit)} trend="7D" icon={TrendingUp} trendUp={dashboardSummary.weeklyProfit >= 0} />
                  <StatCard title="Win Rate" value={`${dashboardSummary.winRate.toFixed(1)}%`} trend="Synced" icon={CheckCircle2} trendUp={dashboardSummary.winRate >= 50} />
                  <StatCard title="Sharpe Ratio" value={dashboardSummary.sharpeRatio.toFixed(2)} trend="Live" icon={Activity} trendUp={dashboardSummary.sharpeRatio >= 1} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-medium text-zinc-100">Cumulative Profit (50 Days)</h3>
                      <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded font-mono border border-emerald-500/20">Live Sync</span>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={profitData}>
                          <defs>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis dataKey="day" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} />
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#e4e4e7' }} itemStyle={{ color: '#10b981' }} />
                          <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div data-testid="recent-fills-panel" className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50">
                      <h3 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
                        <ArrowRightLeft size={16} className="text-zinc-400" /> Recent Fills
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                      {recentFills.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Waiting for executions...</div>
                      ) : (
                        <div className="divide-y divide-zinc-800/50">
                          {recentFills.map((fill) => (
                            <div data-testid="recent-fill-row" key={fill.id} className="p-3 hover:bg-zinc-800/30 transition-colors flex justify-between items-center text-sm">
                              <div>
                                <div className="font-medium text-zinc-200">{fill.market}</div>
                                <div className="text-xs text-zinc-500 font-mono">{fill.time}</div>
                              </div>
                              <div className="text-right">
                                <div className={`font-mono font-medium ${fill.side === 'Yes' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {fill.side} @ ${fill.price.toFixed(3)}
                                </div>
                                <div className="text-xs text-zinc-400">Size: {fill.size}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-zinc-100 mb-6">Capital Allocation</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolioAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {portfolioAllocation.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#e4e4e7' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/50">
                      <h3 className="text-sm font-medium text-zinc-100">Active Positions</h3>
                      <span className="text-xs text-zinc-400 font-mono">Total Exposure: {formatMoney(portfolioExposure)}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/30 border-b border-zinc-800/50">
                          <tr>
                            <th className="px-4 py-3 font-medium">Market</th>
                            <th className="px-4 py-3 font-medium">Side</th>
                            <th className="px-4 py-3 font-medium">Size</th>
                            <th className="px-4 py-3 font-medium">Entry</th>
                            <th className="px-4 py-3 font-medium">Current</th>
                            <th className="px-4 py-3 font-medium text-right">Unrealized PnL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {positions.map((position) => (
                            <tr data-testid="position-row" key={position.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                              <td className="px-4 py-4 font-medium text-zinc-200">{position.market}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${position.side === 'Yes' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {position.side}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-mono text-zinc-400">{position.size}</td>
                              <td className="px-4 py-4 font-mono text-zinc-400">${position.entry.toFixed(3)}</td>
                              <td className="px-4 py-4 font-mono text-zinc-200">${position.current.toFixed(3)}</td>
                              <td className={`px-4 py-4 font-mono text-right font-medium ${position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'health' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><Cpu size={16} /> CPU Usage</div>
                    <div className="text-2xl font-mono text-zinc-100">{latestMetric.cpu.toFixed(1)}%</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><HardDrive size={16} /> Memory Allocation</div>
                    <div className="text-2xl font-mono text-zinc-100">{(latestMetric.memoryMb / 1024).toFixed(1)} / 8.0 GB</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><Network size={16} /> API Latency</div>
                    <div className="text-2xl font-mono text-emerald-400">{latestMetric.latency.toFixed(0)} ms</div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-100 mb-6">Real-time Infrastructure Metrics</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={systemMetrics.map((item, idx) => ({ ...item, time: idx + 1 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="time" stroke="#52525b" fontSize={12} tick={false} axisLine={false} />
                        <YAxis yAxisId="left" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 200]} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#e4e4e7' }} />
                        <Legend verticalAlign="top" height={36} />
                        <Line yAxisId="left" type="monotone" dataKey="cpu" name="CPU (%)" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="monotone" dataKey="latency" name="Latency (ms)" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-4xl space-y-6 animate-in fade-in duration-500">
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800/80">
                    <h2 className="text-lg font-semibold text-zinc-100">Trading Configuration</h2>
                    <p className="text-sm text-zinc-400 mt-1">Adjust core parameters for the OpenClaw agent.</p>
                  </div>
                  <div className="p-6 space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Active Strategies</h3>
                      {strategies.map((strategy) => (
                        <div key={strategy.name} className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800/50">
                          <div>
                            <div className="font-medium text-zinc-200">{strategyTitle(strategy.name)}</div>
                            <div className="text-xs text-zinc-500">{strategy.description}</div>
                          </div>
                          <button
                            onClick={() => updateStrategyEnabled(strategy.name, !strategy.enabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative ${strategy.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${strategy.enabled ? 'left-6' : 'left-1'}`}></span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-6 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Risk Limits</h3>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm text-zinc-400">Max Position Size (USDC)</label>
                          <span className="text-sm font-mono text-zinc-200">${maxPositionRule.value.toLocaleString()}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="10000"
                          value={maxPositionRule.value}
                          onChange={(event) => updateRiskRule('max_position_usdc', Number(event.target.value))}
                          className="w-full accent-emerald-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm text-zinc-400">Global Stop Loss (Drawdown %)</label>
                          <span className="text-sm font-mono text-red-400">{stopLossRule.value.toFixed(1)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          value={stopLossRule.value}
                          onChange={(event) => updateRiskRule('global_stop_loss_pct', Number(event.target.value))}
                          className="w-full accent-red-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Execution Mode</h3>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs uppercase tracking-[0.24em] text-emerald-400">Paper Trading</div>
                            <div className="mt-1 text-sm text-zinc-300">
                              Live Polymarket prices drive the strategy, but fills only hit the local simulated account.
                            </div>
                          </div>
                          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            {tradingStatus?.paperTrading.mode?.toUpperCase() ?? 'PAPER'}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Live Feed</div>
                            <div data-testid="paper-feed-status" className={`mt-1 text-sm font-medium ${tradingStatus?.paperTrading.liveDataConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {tradingStatus?.paperTrading.liveDataConnected ? 'Connected' : 'Reconnecting'}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {tradingStatus?.paperTrading.source ?? 'seed'} · {tradingStatus?.paperTrading.marketCount ?? liveMarkets.length} markets
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Paper Account</div>
                            <div className="mt-1 text-sm font-medium text-zinc-200">
                              {formatMoney(tradingStatus?.paperTrading.totalEquity ?? totalEquity)}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Cash {formatMoney(tradingStatus?.paperTrading.cashBalance ?? totalEquity)} / Start {formatMoney(tradingStatus?.paperTrading.startingCash ?? 15000)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 md:col-span-2">
                            <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Last Sync</div>
                            <div className="mt-1 text-sm text-zinc-300">{formatDateTime(tradingStatus?.paperTrading.lastSyncAt)}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Latency {tradingStatus?.paperTrading.lastLatencyMs ?? latestMetric.latency} ms
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">API Credentials</h3>
                      <div data-testid="credential-status" className="text-xs text-zinc-500">
                        Status: {credentialStatus.configured ? 'Configured' : 'Not configured'}
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Polymarket Key ID</label>
                        <input
                          data-testid="key-id-input"
                          type="text"
                          value={keyIdInput}
                          onChange={(event) => setKeyIdInput(event.target.value)}
                          placeholder="optional"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Polymarket API Key</label>
                        <input
                          data-testid="api-key-input"
                          type="password"
                          value={apiKeyInput}
                          onChange={(event) => setApiKeyInput(event.target.value)}
                          placeholder="leave blank to keep current"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Polymarket API Secret</label>
                        <input
                          data-testid="api-secret-input"
                          type="password"
                          value={secretInput}
                          onChange={(event) => setSecretInput(event.target.value)}
                          placeholder="leave blank to keep current"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Polymarket Passphrase</label>
                        <input
                          data-testid="passphrase-input"
                          type="password"
                          value={passphraseInput}
                          onChange={(event) => setPassphraseInput(event.target.value)}
                          placeholder="leave blank to keep current"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-300 font-mono text-sm focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-zinc-500">
                        Save requires all three values together: apiKey, secret, and passphrase. These keys do not switch the app into real-money mode.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50 flex justify-end">
                      <button
                        data-testid="save-settings"
                        onClick={() => void handleSaveSettings()}
                        disabled={settingsSaving}
                        className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {settingsSaving ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'markets' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="mb-8 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 mb-2">Live Market Feeds</h2>
                    <p className="text-zinc-400">Real-time order book data via high-frequency WebSocket connection.</p>
                  </div>
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border ${wsConnected ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                    <Wifi size={14} className={wsConnected ? 'animate-pulse' : ''} />
                    {wsConnected ? 'WS Connected' : 'WS Reconnecting'}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      placeholder="Search markets by name or keyword..."
                      value={marketSearch}
                      onChange={(event) => setMarketSearch(event.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <select
                      value={strategyFilter}
                      onChange={(event) => setStrategyFilter(event.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="All">All Strategies</option>
                      <option value="Arbitrage">Arbitrage</option>
                      <option value="Price Dislocation">Price Dislocation</option>
                      <option value="Market Maker">Market Maker</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredMarkets.length === 0 ? (
                    <div className="col-span-full py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                      <Search className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
                      <h3 className="text-sm font-medium text-zinc-300">No markets found</h3>
                      <p className="text-xs text-zinc-500 mt-1">Try adjusting your search or strategy filter.</p>
                    </div>
                  ) : (
                    filteredMarkets.map((market) => {
                      const total = market.yes + market.no;
                      const isArb = total < 1.0;
                      const spread = Math.abs(1.0 - total).toFixed(3);

                      return (
                        <div data-testid="market-card" key={market.id} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col relative overflow-hidden shadow-sm">
                          {isArb && <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse"></div>}
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold text-zinc-100">{market.name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isArb ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                              {market.strategy}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-3">
                              <div className="text-xs text-zinc-500 mb-1">Yes (Bid)</div>
                              <div className="text-2xl font-bold"><PriceCell price={market.yes} prevPrice={market.prevYes} /></div>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-3">
                              <div className="text-xs text-zinc-500 mb-1">No (Ask)</div>
                              <div className="text-2xl font-bold"><PriceCell price={market.no} prevPrice={market.prevNo} /></div>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full overflow-hidden flex mb-4 bg-zinc-800">
                            <div style={{ width: `${(market.yes / total) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-300"></div>
                            <div style={{ width: `${(market.no / total) * 100}%` }} className="bg-red-500 h-full transition-all duration-300"></div>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800/50 text-xs text-zinc-400">
                            <div className="flex gap-4">
                              <span>Vol: <span className="text-zinc-200">{formatCompact(market.volume)}</span></span>
                              <span>Liq: <span className="text-zinc-200">{formatCompact(market.liquidity)}</span></span>
                            </div>
                            {isArb ? (
                              <span className="text-purple-400 font-mono flex items-center gap-1">
                                <Zap size={12} /> Arb Spread: ${spread}
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-mono">Sum: ${total.toFixed(3)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'strategies' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">Core Trading Strategies</h2>
                  <p className="text-zinc-400">The "Gambling Lobster" AI relies on three highly specialized, low-latency strategies to extract value from prediction markets.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {strategies.map((strategy) => (
                    <div key={strategy.name}>
                      <StrategyCard
                        icon={strategy.name === 'Arbitrage' ? Scale : strategy.name === 'Price Dislocation' ? Clock : Activity}
                        title={strategyTitle(strategy.name)}
                        description={strategy.description}
                        status={strategy.enabled ? 'Active' : 'Paused'}
                        color={strategy.name === 'Arbitrage' ? 'purple' : strategy.name === 'Price Dislocation' ? 'emerald' : 'blue'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'risks' && (
              <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">The Reality of "Sleep Income"</h2>
                  <p className="text-zinc-400">Behind the viral success stories lies a highly competitive, capital-intensive "Silicon Arms Race".</p>
                </div>
                <div className="grid gap-4">
                  <RiskCard title="High Capital & Infrastructure Barrier" description="Stable profitability requires high initial capital and low-latency infrastructure." />
                  <RiskCard title="Survivorship Bias & Hidden Losses" description="Viral posts usually hide drawdowns, failed runs, and tuning complexity." />
                  <RiskCard title="Ecological Competition & Platform Limits" description="As more bots enter, arbitrage windows shrink and platform countermeasures increase." />
                </div>

                {riskEvents.length > 0 && (
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-200">Recent Risk Alerts</div>
                    <div className="divide-y divide-zinc-800/50">
                      {riskEvents.slice(0, 6).map((event) => (
                        <div key={event.id} className="px-4 py-3 text-sm flex items-start justify-between gap-4">
                          <div>
                            <div className="text-zinc-200">{event.message}</div>
                            <div className="text-xs text-zinc-500 mt-1">{new Date(event.createdAt).toLocaleString()}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${event.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {event.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl h-[calc(100vh-8rem)] flex flex-col overflow-hidden font-mono animate-in fade-in duration-500 shadow-xl">
                <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <span className="ml-4 text-xs text-zinc-500">openclaw-agent-tty1</span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-2 text-sm custom-scrollbar">
                  {logs.map((log) => {
                    const type = logType(log);
                    return (
                      <div key={log.id} className="flex gap-4 hover:bg-zinc-900/50 px-2 py-1 rounded">
                        <span className="text-zinc-600 shrink-0">{log.time}</span>
                        <span className={`shrink-0 w-20 ${type === 'INFO' ? 'text-blue-400' : type === 'EXECUTE' ? 'text-emerald-400' : type === 'RISK' ? 'text-red-400' : 'text-purple-400'}`}>
                          [{type}]
                        </span>
                        <span className="text-zinc-300">{log.message}</span>
                      </div>
                    );
                  })}
                  <div className="animate-pulse text-zinc-600">_</div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function PriceCell({ price, prevPrice }: { price: number; prevPrice: number }) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price > prevPrice) setFlash('up');
    else if (price < prevPrice) setFlash('down');
    const timer = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  const baseColor = flash === 'up' ? 'text-emerald-400 bg-emerald-500/20' : flash === 'down' ? 'text-red-400 bg-red-500/20' : 'text-zinc-300 bg-transparent';

  return <span className={`font-mono px-2 py-1 rounded transition-colors duration-300 ${baseColor}`}>${price.toFixed(3)}</span>;
}

function StatCard({
  title,
  value,
  trend,
  icon: Icon,
  trendUp,
}: {
  title: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ size?: number }>;
  trendUp: boolean;
}) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-medium text-zinc-400">{title}</span>
        <div className="p-2 bg-zinc-800/50 rounded-lg text-zinc-300">
          <Icon size={18} />
        </div>
      </div>
      <div className="flex items-end justify-between mt-auto">
        <span className="text-2xl font-bold text-zinc-100 tracking-tight">{value}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-md ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{trend}</span>
      </div>
    </div>
  );
}

function StrategyCard({
  icon: Icon,
  title,
  description,
  status,
  color,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  status: string;
  color: 'purple' | 'emerald' | 'blue';
}) {
  const colorMap = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 flex flex-col shadow-sm hover:border-zinc-700 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border ${colorMap[color]}`}>
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-3">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed mb-6 flex-1">{description}</p>
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</span>
        <span className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded border ${status === 'Active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`}></span>
          {status}
        </span>
      </div>
    </div>
  );
}

function RiskCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-6 flex gap-4 shadow-sm">
      <div className="shrink-0 mt-1">
        <AlertTriangle className="text-red-500/70" size={24} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-red-200/90 mb-2">{title}</h3>
        <p className="text-sm text-red-200/60 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
