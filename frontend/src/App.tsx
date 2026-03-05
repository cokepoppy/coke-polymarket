import React, { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Zap, Clock, Scale, Terminal, AlertTriangle, 
  BarChart3, Settings, ShieldAlert, Cpu, Server, DollarSign, Play, 
  Square, Wifi, PieChart as PieChartIcon, Sliders, HardDrive, 
  Network, CheckCircle2, ArrowRightLeft, Wallet, Search, Filter
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

// --- MOCK DATA & CONFIG ---
const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444'];

const profitData = Array.from({ length: 50 }, (_, i) => ({
  day: `Day ${i + 1}`,
  profit: Math.floor(Math.random() * 5000) + i * 2000 + 10000,
}));

const initialMarkets = [
  { id: 1, name: 'Will BTC hit $100k in March?', yes: 0.45, no: 0.53, volume: '$1.2M', strategy: 'Arbitrage', liquidity: '$450K' },
  { id: 2, name: 'ETH 15m Price Up?', yes: 0.82, no: 0.16, volume: '$450K', strategy: 'Price Dislocation', liquidity: '$120K' },
  { id: 3, name: 'Fed Rate Cut in June?', yes: 0.31, no: 0.68, volume: '$3.5M', strategy: 'Market Maker', liquidity: '$1.1M' },
  { id: 4, name: 'SOL > $200 by Friday?', yes: 0.50, no: 0.49, volume: '$890K', strategy: 'Arbitrage', liquidity: '$340K' },
  { id: 5, name: 'OpenAI releases GPT-5 in 2024?', yes: 0.72, no: 0.29, volume: '$2.1M', strategy: 'Market Maker', liquidity: '$800K' },
  { id: 6, name: 'US Election: Democratic Nominee?', yes: 0.51, no: 0.48, volume: '$15.2M', strategy: 'Arbitrage', liquidity: '$5.5M' },
];

const initialLogs = [
  { time: '10:42:01', type: 'INFO', message: 'Connected to Polymarket API Node (Latency: 12ms)' },
  { time: '10:42:05', type: 'STRATEGY', message: 'Scanning for Math Parity Arbitrage opportunities...' },
];

const portfolioAllocation = [
  { name: 'USDC (Idle)', value: 4500 },
  { name: 'Active Arbitrage', value: 5200 },
  { name: 'Market Making', value: 2750 },
];

const initialPositions = [
  { id: 'pos1', market: 'BTC 100k March', side: 'Yes', size: 5000, entry: 0.42, current: 0.45, pnl: 150 },
  { id: 'pos2', market: 'Fed Rate Cut', side: 'No', size: 12000, entry: 0.65, current: 0.68, pnl: 360 },
  { id: 'pos3', market: 'ETH 15m Up', side: 'Yes', size: 2500, entry: 0.80, current: 0.82, pnl: 50 },
];

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dynamic States
  const [logs, setLogs] = useState(initialLogs);
  const [liveMarkets, setLiveMarkets] = useState(initialMarkets.map(m => ({ ...m, prevYes: m.yes, prevNo: m.no })));
  const [recentFills, setRecentFills] = useState<{time: string, market: string, side: string, price: number, size: number}[]>([]);
  const [marketSearch, setMarketSearch] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('All');
  const [systemMetrics, setSystemMetrics] = useState(Array.from({length: 20}, (_, i) => ({ time: i, cpu: 45, latency: 12 })));
  const [positions, setPositions] = useState(initialPositions);

  // 1. Live Markets & Arbitrage Engine Simulation
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setLiveMarkets(current => current.map(market => {
        if (Math.random() > 0.7) return market;
        const volatility = market.strategy === 'Price Dislocation' ? 0.04 : 0.015;
        let newYes = Math.max(0.001, Math.min(0.999, market.yes + (Math.random() - 0.5) * volatility));
        let newNo = Math.max(0.001, Math.min(0.999, market.no + (Math.random() - 0.5) * volatility));
        
        if (Math.random() > 0.85 && market.strategy === 'Arbitrage') {
            newYes -= 0.012; newNo -= 0.012; // Force Arb
        } else if (market.strategy !== 'Arbitrage') {
            const sum = newYes + newNo; newYes /= sum; newNo /= sum;
        }
        return { ...market, prevYes: market.yes, prevNo: market.no, yes: newYes, no: newNo };
      }));
    }, 800);
    return () => clearInterval(interval);
  }, [isRunning]);

  // 2. Logs & Fills Simulation
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      const isFill = Math.random() > 0.6;
      
      if (isFill) {
        const randomMarket = initialMarkets[Math.floor(Math.random() * initialMarkets.length)];
        const side = Math.random() > 0.5 ? 'Yes' : 'No';
        const price = side === 'Yes' ? randomMarket.yes : randomMarket.no;
        const size = Math.floor(Math.random() * 500) * 10 + 100;
        
        setRecentFills(prev => [{ time, market: randomMarket.name, side, price, size }, ...prev].slice(0, 15));
        setLogs(prev => [{ time, type: 'EXECUTE', message: `FILLED: Buy ${size} ${side} @ $${price.toFixed(3)} on ${randomMarket.name}` }, ...prev].slice(0, 50));
      } else {
        setLogs(prev => [{ time, type: 'STRATEGY', message: `Analyzing orderbook depth for ${initialMarkets[Math.floor(Math.random() * 3)].name}...` }, ...prev].slice(0, 50));
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isRunning]);

  // 3. System Health Simulation
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSystemMetrics(prev => {
        const newCpu = Math.max(10, Math.min(95, prev[prev.length - 1].cpu + (Math.random() - 0.5) * 15));
        const newLat = Math.max(5, Math.min(150, prev[prev.length - 1].latency + (Math.random() - 0.5) * 8));
        return [...prev.slice(1), { time: prev[prev.length - 1].time + 1, cpu: newCpu, latency: newLat }];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // 4. Position PnL Updates
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setPositions(prev => prev.map(p => ({
        ...p,
        current: p.current + (Math.random() - 0.5) * 0.01,
        pnl: p.pnl + (Math.random() - 0.5) * 20
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, [isRunning]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30">
      <div className="flex h-screen overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col z-20">
          <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              <Cpu size={20} weight="bold" />
            </div>
            <div>
              <h1 className="font-bold text-zinc-100 tracking-tight">OpenClaw</h1>
              <p className="text-xs text-emerald-500 font-mono">v3.7-Sonnet Active</p>
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
                <span>{isRunning ? 'Dedicated API (12ms)' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#09090b] relative">
          {/* Top Header */}
          <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-100 capitalize">
                {activeTab.replace('-', ' ')}
              </h2>
              <div className="h-4 w-px bg-zinc-800"></div>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-300 font-mono">$12,450.00</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 text-xs font-mono mr-4">
                <div className="flex items-center gap-1 text-emerald-400"><TrendingUp size={14}/> +$560 Today</div>
                <div className="h-3 w-px bg-zinc-800"></div>
                <div className="flex items-center gap-1 text-zinc-400"><Activity size={14}/> 142 Trades</div>
              </div>
              <button 
                onClick={() => setIsRunning(!isRunning)}
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
            
            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total Profit (Lifetime)" value="$1.72M" trend="+12.4%" icon={DollarSign} trendUp={true} />
                  <StatCard title="Weekly Profit" value="$115,420" trend="+5.2%" icon={TrendingUp} trendUp={true} />
                  <StatCard title="Win Rate" value="68.4%" trend="Optimal" icon={CheckCircle2} trendUp={true} />
                  <StatCard title="Sharpe Ratio" value="3.2" trend="Excellent" icon={Activity} trendUp={true} />
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
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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

                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col shadow-sm overflow-hidden">
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
                          {recentFills.map((fill, i) => (
                            <div key={i} className="p-3 hover:bg-zinc-800/30 transition-colors flex justify-between items-center text-sm">
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

            {/* --- PORTFOLIO TAB --- */}
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
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#e4e4e7' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/50">
                      <h3 className="text-sm font-medium text-zinc-100">Active Positions</h3>
                      <span className="text-xs text-zinc-400 font-mono">Total Exposure: $19,500</span>
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
                          {positions.map((pos) => (
                            <tr key={pos.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                              <td className="px-4 py-4 font-medium text-zinc-200">{pos.market}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${pos.side === 'Yes' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {pos.side}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-mono text-zinc-400">{pos.size}</td>
                              <td className="px-4 py-4 font-mono text-zinc-400">${pos.entry.toFixed(3)}</td>
                              <td className="px-4 py-4 font-mono text-zinc-200">${pos.current.toFixed(3)}</td>
                              <td className={`px-4 py-4 font-mono text-right font-medium ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
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

            {/* --- SYSTEM HEALTH TAB --- */}
            {activeTab === 'health' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><Cpu size={16}/> CPU Usage</div>
                    <div className="text-2xl font-mono text-zinc-100">{systemMetrics[systemMetrics.length-1].cpu.toFixed(1)}%</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><HardDrive size={16}/> Memory Allocation</div>
                    <div className="text-2xl font-mono text-zinc-100">2.4 / 8.0 GB</div>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
                    <div className="text-zinc-400 text-sm mb-1 flex items-center gap-2"><Network size={16}/> API Latency</div>
                    <div className="text-2xl font-mono text-emerald-400">{systemMetrics[systemMetrics.length-1].latency.toFixed(0)} ms</div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-zinc-100 mb-6">Real-time Infrastructure Metrics</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={systemMetrics}>
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

            {/* --- SETTINGS TAB --- */}
            {activeTab === 'settings' && (
              <div className="max-w-4xl space-y-6 animate-in fade-in duration-500">
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800/80">
                    <h2 className="text-lg font-semibold text-zinc-100">Trading Configuration</h2>
                    <p className="text-sm text-zinc-400 mt-1">Adjust core parameters for the OpenClaw agent.</p>
                  </div>
                  <div className="p-6 space-y-8">
                    
                    {/* Toggles */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Active Strategies</h3>
                      {[
                        { name: 'Math Parity Arbitrage', desc: 'Exploit Yes+No < 1.00', active: true },
                        { name: 'Price Dislocation', desc: 'High-frequency momentum trading', active: true },
                        { name: 'Market Making', desc: 'Provide liquidity for spread', active: false },
                      ].map((strat, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800/50">
                          <div>
                            <div className="font-medium text-zinc-200">{strat.name}</div>
                            <div className="text-xs text-zinc-500">{strat.desc}</div>
                          </div>
                          <button className={`w-11 h-6 rounded-full transition-colors relative ${strat.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${strat.active ? 'left-6' : 'left-1'}`}></span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Sliders */}
                    <div className="space-y-6 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Risk Limits</h3>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm text-zinc-400">Max Position Size (USDC)</label>
                          <span className="text-sm font-mono text-zinc-200">$5,000</span>
                        </div>
                        <input type="range" min="100" max="10000" defaultValue="5000" className="w-full accent-emerald-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer" />
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm text-zinc-400">Global Stop Loss (Drawdown %)</label>
                          <span className="text-sm font-mono text-red-400">15.0%</span>
                        </div>
                        <input type="range" min="1" max="50" defaultValue="15" className="w-full accent-red-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer" />
                      </div>
                    </div>

                    {/* API Keys */}
                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">API Credentials</h3>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Polymarket API Key</label>
                        <input type="password" value="************************" readOnly className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-400 font-mono text-sm focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">RPC Node Endpoint</label>
                        <input type="text" value="https://polygon-mainnet.g.alchemy.com/v2/..." readOnly className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-400 font-mono text-sm focus:outline-none" />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* --- LIVE MARKETS TAB --- */}
            {activeTab === 'markets' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="mb-8 flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 mb-2">Live Market Feeds</h2>
                    <p className="text-zinc-400">Real-time order book data via high-frequency WebSocket connection.</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                    <Wifi size={14} className="animate-pulse" />
                    WS Connected (12ms)
                  </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      placeholder="Search markets by name or keyword..."
                      value={marketSearch}
                      onChange={(e) => setMarketSearch(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <select
                      value={strategyFilter}
                      onChange={(e) => setStrategyFilter(e.target.value)}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="All">All Strategies</option>
                      <option value="Arbitrage">Arbitrage</option>
                      <option value="Price Dislocation">Price Dislocation</option>
                      <option value="Market Maker">Market Maker</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {(() => {
                    const filteredMarkets = liveMarkets.filter(market => {
                      const matchesSearch = market.name.toLowerCase().includes(marketSearch.toLowerCase());
                      const matchesStrategy = strategyFilter === 'All' || market.strategy === strategyFilter;
                      return matchesSearch && matchesStrategy;
                    });

                    if (filteredMarkets.length === 0) {
                      return (
                        <div className="col-span-full py-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                          <Search className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
                          <h3 className="text-sm font-medium text-zinc-300">No markets found</h3>
                          <p className="text-xs text-zinc-500 mt-1">Try adjusting your search or strategy filter.</p>
                        </div>
                      );
                    }

                    return filteredMarkets.map(market => {
                      const total = market.yes + market.no;
                      const isArb = total < 1.0;
                      const spread = Math.abs(1.0 - total).toFixed(3);

                      return (
                      <div key={market.id} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col relative overflow-hidden shadow-sm">
                        {isArb && <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse"></div>}
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-semibold text-zinc-100">{market.name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isArb ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
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

                        {/* Visual Depth Bar */}
                        <div className="w-full h-2 rounded-full overflow-hidden flex mb-4 bg-zinc-800">
                          <div style={{width: `${(market.yes / total) * 100}%`}} className="bg-emerald-500 h-full transition-all duration-300"></div>
                          <div style={{width: `${(market.no / total) * 100}%`}} className="bg-red-500 h-full transition-all duration-300"></div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800/50 text-xs text-zinc-400">
                          <div className="flex gap-4">
                            <span>Vol: <span className="text-zinc-200">{market.volume}</span></span>
                            <span>Liq: <span className="text-zinc-200">{market.liquidity}</span></span>
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
                  });
                  })()}
                </div>
              </div>
            )}

            {/* --- STRATEGIES TAB --- */}
            {activeTab === 'strategies' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">Core Trading Strategies</h2>
                  <p className="text-zinc-400">The "Gambling Lobster" AI relies on three highly specialized, low-latency strategies to extract value from prediction markets.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StrategyCard icon={Scale} title="Math Parity Arbitrage" description="Exploits binary option mechanics where Yes + No must equal $1.00. When market panic or liquidity drops cause the sum to fall below $1.00, the bot instantly buys both sides for risk-free profit." status="Active" color="purple" />
                  <StrategyCard icon={Clock} title="Short-Term Price Dislocation" description="Hyper-focuses on 5m/15m crypto prediction markets. Reacts to liquidations and extreme volatility faster than human traders, capturing mispriced contracts before the market corrects." status="Active" color="emerald" />
                  <StrategyCard icon={Activity} title="Digital Market Maker" description="Provides continuous two-sided liquidity (Bid/Ask). Earns micro-profits on the spread while simultaneously farming Polymarket's liquidity provision rewards." status="Active" color="blue" />
                </div>
              </div>
            )}

            {/* --- RISKS TAB --- */}
            {activeTab === 'risks' && (
              <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-zinc-100 mb-2">The Reality of "Sleep Income"</h2>
                  <p className="text-zinc-400">Behind the viral success stories lies a highly competitive, capital-intensive "Silicon Arms Race".</p>
                </div>
                <div className="grid gap-4">
                  <RiskCard title="High Capital & Infrastructure Barrier" description="Stable profitability requires $5,000 - $10,000 initial capital. You cannot run this on a standard laptop; it requires dedicated servers, Mac Minis, and low-latency API nodes to beat competitors." />
                  <RiskCard title="Survivorship Bias & Hidden Losses" description="Viral posts hide the massive drawdowns and catastrophic failures. 'Zero effort = Zero success'. Running these bots requires deep quantitative background and constant tuning." />
                  <RiskCard title="Ecological Competition & Platform Limits" description="As more LLM-powered agents (like Claude 3.7) enter the market, arbitrage windows shrink to milliseconds. Polymarket is also actively adjusting fees and latency to curb malicious bot behavior." />
                </div>
              </div>
            )}

            {/* --- LOGS TAB --- */}
            {activeTab === 'logs' && (
              <div className="bg-[#0c0c0e] border border-zinc-800 rounded-xl h-[calc(100vh-8rem)] flex flex-col overflow-hidden font-mono animate-in fade-in duration-500 shadow-xl">
                <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <span className="ml-4 text-xs text-zinc-500">openclaw-agent-tty1</span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-2 text-sm custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 hover:bg-zinc-900/50 px-2 py-1 rounded">
                      <span className="text-zinc-600 shrink-0">{log.time}</span>
                      <span className={`shrink-0 w-20 ${log.type === 'INFO' ? 'text-blue-400' : log.type === 'EXECUTE' ? 'text-emerald-400' : 'text-purple-400'}`}>[{log.type}]</span>
                      <span className="text-zinc-300">{log.message}</span>
                    </div>
                  ))}
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

// --- SUBCOMPONENTS ---

function PriceCell({ price, prevPrice }: { price: number, prevPrice: number }) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (price > prevPrice) setFlash('up');
    else if (price < prevPrice) setFlash('down');
    const timer = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  const baseColor = flash === 'up' ? 'text-emerald-400 bg-emerald-500/20' : 
                    flash === 'down' ? 'text-red-400 bg-red-500/20' : 'text-zinc-300 bg-transparent';

  return (
    <span className={`font-mono px-2 py-1 rounded transition-colors duration-300 ${baseColor}`}>
      ${price.toFixed(3)}
    </span>
  );
}

function StatCard({ title, value, trend, icon: Icon, trendUp }: any) {
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
        <span className={`text-xs font-medium px-2 py-1 rounded-md ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

function StrategyCard({ icon: Icon, title, description, status, color }: any) {
  const colorMap: any = {
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
        <span className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {status}
        </span>
      </div>
    </div>
  );
}

function RiskCard({ title, description }: any) {
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
