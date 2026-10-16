import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import './App.css';
import planImg from './assets/ship_floor_plan.webp';

// ==================== Types ====================

interface MobileFireData {
  alert?: boolean | null;
  fireCenterX?: number | null;
  fireCenterY?: number | null;
  fireIntensity?: number | null;
}

interface TerminalInfo {
  smokeAlert?: boolean;
  batteryPercent?: number | null;
  temperature?: number | null;
  dotCnt?: number;
  personCnt?: number;
  online?: boolean;
}

type TabKey = 'overview' | 'fire' | 'terminal';

// ==================== Icons (inline SVG) ====================

const IconShip = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.9 5.8 2.8 8" />
    <path d="M12 10V4" /><path d="M8 6h8" />
  </svg>
);

const IconFlame = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.6-3.3.7 1.7 2.4 2.6 2.9 3.8z" />
  </svg>
);

const IconCpu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconWifi = ({ connected }: { connected: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={connected ? '#22c55e' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {connected ? (
      <>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
      </>
    ) : (
      <>
        <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </>
    )}
  </svg>
);

const IconThermometer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconRadar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);

const IconBattery = ({ percent }: { percent?: number | null }) => {
  const p = percent ?? 0;
  const color = p > 50 ? '#22c55e' : p > 20 ? '#eab308' : '#ef4444';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="18" height="12" rx="2" ry="2" /><line x1="23" y1="13" x2="23" y2="11" />
      <rect x="3" y="8" width={Math.max(0, Math.min(14, (p / 100) * 14))} height="8" fill={color} stroke="none" rx="1" />
    </svg>
  );
};

const IconSmoke = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
    <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
    <path d="M19 11h2m-1 -1v2" />
  </svg>
);

// ==================== Main App Component ====================

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // --- Mobile Fire Data State ---
  const [mobileData, setMobileData] = useState<MobileFireData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // --- Terminal State ---
  const [terminalList, setTerminalList] = useState<string[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null);
  const [terminalLoading, setTerminalLoading] = useState(false);

  // --- Thermal Viewer State ---
  const [thermalUrl, setThermalUrl] = useState<string | null>(null);
  const thermalWsRef = useRef<WebSocket | null>(null);
  const thermalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Simulation Form State ---
  const [simForm, setSimForm] = useState({
    id: '',
    smokeAlert: false,
    batteryPercent: 80,
    temperature: 25.0,
    dotCnt: 0,
    personCnt: 0,
  });
  const [simSubmitting, setSimSubmitting] = useState(false);

  // --- Fire Modify Form State ---
  const [fireForm, setFireForm] = useState({
    alert: false,
    fireCenterX: 0,
    fireCenterY: 0,
    fireIntensity: 0.5,
  });
  const [fireSubmitting, setFireSubmitting] = useState(false);

  // ==================== Data Fetching ====================

  const fetchMobileData = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/data');
      if (res.ok) setMobileData(await res.json());
    } catch (e) { console.error('fetchMobileData:', e); }
  }, []);

  const fetchTerminalList = useCallback(async () => {
    try {
      const res = await fetch('/api/terminal/list');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          setTerminalList(list);
          if (list.length > 0 && selectedTerminalId === null) {
            setSelectedTerminalId(list[0]);
          }
        }
      }
    } catch (e) { console.error('fetchTerminalList:', e); }
  }, [selectedTerminalId]);

  const fetchTerminalInfo = useCallback(async (id: string) => {
    setTerminalLoading(true);
    try {
      const res = await fetch(`/api/terminal/info/${encodeURIComponent(id)}`);
      if (res.ok) setTerminalInfo(await res.json());
    } catch (e) { console.error('fetchTerminalInfo:', e); }
    finally { setTerminalLoading(false); }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchMobileData();
    fetchTerminalList();
    const interval = setInterval(() => {
      fetchMobileData();
      fetchTerminalList();
      if (selectedTerminalId) fetchTerminalInfo(selectedTerminalId);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMobileData, fetchTerminalList, fetchTerminalInfo, selectedTerminalId]);

  // Refetch terminal info when selection changes
  useEffect(() => {
    if (selectedTerminalId) fetchTerminalInfo(selectedTerminalId);
  }, [selectedTerminalId, fetchTerminalInfo]);

  // Sync fire form when mobile data updates
  useEffect(() => {
    if (mobileData) {
      setFireForm(prev => ({
        alert: mobileData.alert ?? prev.alert,
        fireCenterX: mobileData.fireCenterX ?? prev.fireCenterX,
        fireCenterY: mobileData.fireCenterY ?? prev.fireCenterY,
        fireIntensity: mobileData.fireIntensity ?? prev.fireIntensity,
      }));
    }
  }, [mobileData]);

  // ==================== Mobile WebSocket ====================

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${location.host}/api/mobile/ws`);

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          setMobileData(data);
        } catch { /* ignore non-JSON */ }
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // ==================== Thermal Viewer WebSocket ====================

  useEffect(() => {
    // Cleanup previous thermal WS
    if (thermalWsRef.current) {
      thermalWsRef.current.close();
      thermalWsRef.current = null;
    }
    setThermalUrl(null);

    if (!selectedTerminalId || activeTab !== 'terminal') return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/terminal/view/${encodeURIComponent(selectedTerminalId)}`);
    thermalWsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onmessage = (evt) => {
      if (typeof evt.data === 'string') {
        // "ping" keepalive — ignore
        return;
      }
      // Binary frame: render as image blob
      const blob = new Blob([evt.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setThermalUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };

    ws.onclose = () => setThermalUrl(null);
    ws.onerror = () => setThermalUrl(null);

    return () => {
      ws.close();
      thermalWsRef.current = null;
    };
  }, [selectedTerminalId, activeTab]);

  // ==================== Actions ====================

  const submitFireModify = async () => {
    setFireSubmitting(true);
    try {
      await fetch('/api/mobile/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: fireForm.alert,
          fireCenterX: fireForm.fireCenterX,
          fireCenterY: fireForm.fireCenterY,
          fireIntensity: fireForm.fireIntensity,
        }),
      });
      await fetchMobileData();
    } catch (e) { console.error('submitFireModify:', e); }
    finally { setFireSubmitting(false); }
  };

  const submitTerminalReport = async () => {
    if (!simForm.id.trim()) return;
    setSimSubmitting(true);
    try {
      await fetch('/api/terminal/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: simForm.id.trim(),
          smokeAlert: simForm.smokeAlert,
          batteryPercent: simForm.batteryPercent,
          temperature: simForm.temperature,
          dotCnt: simForm.dotCnt,
          personCnt: simForm.personCnt,
        }),
      });
      await fetchTerminalList();
      if (selectedTerminalId === simForm.id.trim()) {
        await fetchTerminalInfo(simForm.id.trim());
      }
    } catch (e) { console.error('submitTerminalReport:', e); }
    finally { setSimSubmitting(false); }
  };

  const handleFloorPlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 2056 / rect.width;
    const scaleY = 1080 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setFireForm(prev => ({ ...prev, fireCenterX: x, fireCenterY: y }));
  };

  // ==================== Computed Values ====================

  const hasAnyAlert = mobileData?.alert === true || terminalList.some((_, i) => {
    // We only have info for selected terminal; use that
    return false;
  });
  const selectedTerminalAlert = terminalInfo?.smokeAlert === true;
  const totalPersons = terminalInfo?.personCnt ?? 0;
  const maxTemp = terminalInfo?.temperature ?? null;
  const totalDots = terminalInfo?.dotCnt ?? 0;
  const onlineTerminals = terminalList.length; // simplified; real online check needs per-terminal info

  // ==================== Render Helpers ====================

  const StatusDot = ({ online }: { online?: boolean }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-live' : 'bg-slate-300'}`} />
  );

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ===== Top Navbar ===== */}
      <div className="top-navbar-container">
        <nav className="top-navbar">
          {/* Brand */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 mr-1 shrink-0">
            <IconShip />
            <span className="text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">船舶智能监控</span>
          </div>

          {/* Tabs */}
          {([
            ['overview', '系统总览', IconShip],
            ['fire', '火灾监测', IconFlame],
            ['terminal', '智能终端', IconCpu],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              className={`nav-tab-pill ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon />
              {label}
            </button>
          ))}

          {/* Right side: status + refresh */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200 ml-1 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
              <IconWifi connected={wsConnected} />
              <span>{wsConnected ? '实时连接' : '已断开'}</span>
            </div>
            <button
              type="button"
              className="btn-secondary !p-2 !rounded-full"
              onClick={() => { fetchMobileData(); fetchTerminalList(); if (selectedTerminalId) fetchTerminalInfo(selectedTerminalId); }}
              title="刷新数据"
            >
              <IconRefresh />
            </button>
          </div>
        </nav>
      </div>

      {/* ===== Critical Alert Banner ===== */}
      {(mobileData?.alert || selectedTerminalAlert) && (
        <div className="mx-4 mt-4 mb-0 px-5 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 animate-live cursor-pointer"
             onClick={() => setActiveTab('fire')}>
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shrink-0">
            <IconFlame />
          </span>
          <div>
            <div className="text-sm font-bold text-red-700">紧急警报触发</div>
            <div className="text-xs text-red-600">
              {mobileData?.alert && '移动端检测到火灾险情'}
              {mobileData?.alert && selectedTerminalAlert && ' · '}
              {selectedTerminalAlert && `终端 ${selectedTerminalId} 烟雾报警`}
              {' — 点击查看详情'}
            </div>
          </div>
        </div>
      )}

      {/* ===== Main Content ===== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">

        {/* ==================== OVERVIEW TAB ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <IconShip /> 系统状态总览
            </h1>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Fire Alert */}
              <div className={`glass-card flex flex-col gap-2 ${mobileData?.alert ? '!border-red-300 !bg-red-50' : ''}`}>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IconFlame /> 火灾警报
                </div>
                <div className={`text-2xl font-bold ${mobileData?.alert ? 'text-red-600' : 'text-green-600'}`}>
                  {mobileData?.alert ? '警报中' : '安全'}
                </div>
                <div className="text-xs text-slate-400">
                  {mobileData?.alert
                    ? `中心 (${mobileData.fireCenterX}, ${mobileData.fireCenterY})`
                    : '全船巡检正常'}
                </div>
              </div>

              {/* Terminals */}
              <div className="glass-card flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IconCpu /> 在线终端
                </div>
                <div className="text-2xl font-bold text-slate-800">{onlineTerminals}</div>
                <div className="text-xs text-slate-400">台设备已注册</div>
              </div>

              {/* Persons */}
              <div className="glass-card flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IconUsers /> 检测人数
                </div>
                <div className="text-2xl font-bold text-slate-800">{totalPersons}</div>
                <div className="text-xs text-slate-400">当前选中终端</div>
              </div>

              {/* Temperature */}
              <div className="glass-card flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IconThermometer /> 最高温度
                </div>
                <div className={`text-2xl font-bold ${(maxTemp ?? 0) > 60 ? 'text-orange-600' : 'text-slate-800'}`}>
                  {maxTemp !== null ? `${maxTemp.toFixed(1)}℃` : '--'}
                </div>
                <div className="text-xs text-slate-400">热成像峰值</div>
              </div>

              {/* Radar Dots */}
              <div className="glass-card flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IconRadar /> 雷达点云
                </div>
                <div className="text-2xl font-bold text-slate-800">{totalDots}</div>
                <div className="text-xs text-slate-400">毫米波探测点数</div>
              </div>
            </div>

            {/* Fleet Mini Cards */}
            <div className="glass-card">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">终端舰队概览</h2>
              {terminalList.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">暂无已注册终端</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {terminalList.map(id => (
                    <button
                      key={id}
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-center"
                      onClick={() => { setSelectedTerminalId(id); setActiveTab('terminal'); }}
                    >
                      <StatusDot online={true} />
                      <span className="text-sm font-semibold text-slate-700">{id}</span>
                      <span className="text-xs text-slate-400">点击查看</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== FIRE TAB ==================== */}
        {activeTab === 'fire' && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <IconFlame /> 火灾监测与平面图定位
            </h1>

            {/* Fire Data Table */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">移动火灾数据</h2>
                <button type="button" className="btn-secondary !text-xs !py-1.5 !px-3" onClick={fetchMobileData}>
                  <IconRefresh /> 刷新
                </button>
              </div>
              <table className="modern-table">
                <thead><tr><th>属性</th><th>键名</th><th>当前值</th></tr></thead>
                <tbody>
                  <tr>
                    <td>火灾警报</td><td className="font-mono text-xs text-slate-500">alert</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${mobileData?.alert ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {mobileData?.alert ? '⚠ 是' : '✓ 否'}
                      </span>
                    </td>
                  </tr>
                  <tr><td>火灾中心 X</td><td className="font-mono text-xs text-slate-500">fireCenterX</td><td>{mobileData?.fireCenterX ?? '--'} px</td></tr>
                  <tr><td>火灾中心 Y</td><td className="font-mono text-xs text-slate-500">fireCenterY</td><td>{mobileData?.fireCenterY ?? '--'} px</td></tr>
                  <tr><td>火灾强度</td><td className="font-mono text-xs text-slate-500">fireIntensity</td><td>{mobileData?.fireIntensity ?? '--'}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Floor Plan */}
            <div className="glass-card !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">船舶平面图（2056×1080 px）· 点击定位火源</h2>
                <span className="text-xs text-slate-400">底图原始分辨率，可横向滚动</span>
              </div>
              <div className="floor-plan-scroll-area" onClick={handleFloorPlanClick}>
                <div className="relative inline-block min-w-[2056px] min-h-[1080px]">
                  <img src={planImg.src || planImg} alt="船舶平面图" className="block w-[2056px] h-[1080px] max-w-none select-none" draggable={false} />

                  {/* Fire Marker */}
                  {mobileData?.alert && mobileData.fireCenterX != null && mobileData.fireCenterY != null && (
                    <div style={{ position: 'absolute', left: mobileData.fireCenterX, top: mobileData.fireCenterY }}>
                      <div className="fire-marker-pulse" />
                      <div className="fire-marker-core">
                        <div className="fire-marker-tooltip">
                          🔥 火灾中心 ({mobileData.fireCenterX}, {mobileData.fireCenterY})
                          {mobileData.fireIntensity != null && ` · 强度 ${mobileData.fireIntensity}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No-fire overlay hint */}
                  {!mobileData?.alert && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-xl text-sm font-medium text-green-700 border border-green-200 shadow-sm">
                        ✓ 全船巡检正常 · 无火灾险情
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fire Simulation Panel */}
            <div className="glass-card">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">🎛️ 火灾数据模拟 / 调试面板</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  火灾警报
                  <select
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={fireForm.alert ? 'true' : 'false'}
                    onChange={e => setFireForm(p => ({ ...p, alert: e.currentTarget.value === 'true' }))}
                  >
                    <option value="false">否（安全）</option>
                    <option value="true">是（警报）</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  火源 X 坐标 (px)
                  <input type="number" min={0} max={2056}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={fireForm.fireCenterX}
                    onInput={e => setFireForm(p => ({ ...p, fireCenterX: Number(e.currentTarget.value) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  火源 Y 坐标 (px)
                  <input type="number" min={0} max={1080}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={fireForm.fireCenterY}
                    onInput={e => setFireForm(p => ({ ...p, fireCenterY: Number(e.currentTarget.value) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  火灾强度 (0~1)
                  <input type="number" min={0} max={1} step={0.1}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={fireForm.fireIntensity}
                    onInput={e => setFireForm(p => ({ ...p, fireIntensity: Number(e.currentTarget.value) }))}
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-primary" disabled={fireSubmitting} onClick={submitFireModify}>
                  {fireSubmitting ? '提交中...' : '提交修改 → POST /api/mobile/modify'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setFireForm({ alert: true, fireCenterX: 1280, fireCenterY: 450, fireIntensity: 1.0 });
                }}>预设：甲板中部大火</button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setFireForm({ alert: false, fireCenterX: 0, fireCenterY: 0, fireIntensity: 0 });
                }}>清除警报</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TERMINAL TAB ==================== */}
        {activeTab === 'terminal' && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <IconCpu /> 智能终端管理
            </h1>

            {/* Terminal Selector Pills */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">选择终端</h2>
                <button type="button" className="btn-secondary !text-xs !py-1.5 !px-3" onClick={fetchTerminalList}>
                  <IconRefresh /> 刷新列表
                </button>
              </div>
              {terminalList.length === 0 ? (
                <div className="text-sm text-slate-400 py-4 text-center">暂无已注册终端，请先通过模拟器上报数据</div>
              ) : (
                <div className="terminal-selector-bar">
                  {terminalList.map(id => (
                    <button
                      key={id}
                      type="button"
                      className={`terminal-pill-btn ${selectedTerminalId === id ? 'active' : ''}`}
                      onClick={() => setSelectedTerminalId(id)}
                    >
                      <StatusDot online={true} />
                      {id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Terminal Detail */}
            {selectedTerminalId && (
              <div className="glass-card">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-slate-800">终端 {selectedTerminalId}</h2>
                    {terminalInfo && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${terminalInfo.online ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <StatusDot online={terminalInfo.online} />
                        {terminalInfo.online ? '在线' : '离线'}
                      </span>
                    )}
                    {terminalInfo?.smokeAlert && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-live">
                        <IconSmoke /> 烟雾报警
                      </span>
                    )}
                  </div>
                  <button type="button" className="btn-secondary !text-xs !py-1.5 !px-3" onClick={() => fetchTerminalInfo(selectedTerminalId)}>
                    <IconRefresh /> 刷新
                  </button>
                </div>

                {terminalLoading ? (
                  <div className="text-sm text-slate-400 py-8 text-center">加载中...</div>
                ) : terminalInfo ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                    {/* Smoke */}
                    <div className={`flex flex-col gap-2 p-4 rounded-xl border ${terminalInfo.smokeAlert ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IconSmoke /> 烟雾</div>
                      <div className={`text-lg font-bold ${terminalInfo.smokeAlert ? 'text-red-600' : 'text-green-600'}`}>
                        {terminalInfo.smokeAlert ? '报警' : '正常'}
                      </div>
                    </div>
                    {/* Battery */}
                    <div className="flex flex-col gap-2 p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IconBattery percent={terminalInfo.batteryPercent} /> 电量</div>
                      <div className="text-lg font-bold text-slate-800">{terminalInfo.batteryPercent != null ? `${terminalInfo.batteryPercent}%` : '--'}</div>
                      {terminalInfo.batteryPercent != null && (
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${terminalInfo.batteryPercent > 50 ? 'bg-green-500' : terminalInfo.batteryPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                               style={{ width: `${terminalInfo.batteryPercent}%` }} />
                        </div>
                      )}
                    </div>
                    {/* Temperature */}
                    <div className={`flex flex-col gap-2 p-4 rounded-xl border ${(terminalInfo.temperature ?? 0) > 60 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IconThermometer /> 温度</div>
                      <div className={`text-lg font-bold ${(terminalInfo.temperature ?? 0) > 60 ? 'text-orange-600' : 'text-slate-800'}`}>
                        {terminalInfo.temperature != null ? `${terminalInfo.temperature.toFixed(1)}℃` : '--'}
                      </div>
                    </div>
                    {/* Radar Dots */}
                    <div className="flex flex-col gap-2 p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IconRadar /> 雷达点云</div>
                      <div className="text-lg font-bold text-slate-800">{terminalInfo.dotCnt ?? '--'}</div>
                    </div>
                    {/* Persons */}
                    <div className="flex flex-col gap-2 p-4 rounded-xl border bg-slate-50 border-slate-200">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><IconUsers /> 检测人数</div>
                      <div className="text-lg font-bold text-slate-800">{terminalInfo.personCnt != null ? `${terminalInfo.personCnt} 人` : '--'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 py-8 text-center">无法获取终端数据</div>
                )}

                {/* Live Thermal Viewer */}
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    📡 实时热成像画面
                    {thermalUrl && <span className="text-xs font-normal text-green-600 animate-live">● LIVE</span>}
                  </h3>
                  <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center relative">
                    {thermalUrl ? (
                      <img src={thermalUrl} alt="热成像实时画面" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center text-slate-500">
                        <div className="text-3xl mb-2 opacity-30">📡</div>
                        <div className="text-sm">等待热成像数据流...</div>
                        <div className="text-xs mt-1 text-slate-600">WS: /api/terminal/view/{selectedTerminalId}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Report Simulator */}
            <div className="glass-card">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">🧪 终端遥测上报模拟器</h2>
              <p className="text-xs text-slate-400 mb-4">模拟树莓派终端向服务器上报数据，用于调试和演示。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  终端 ID
                  <input type="text" placeholder="例如: RP-001"
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.id}
                    onInput={e => setSimForm(p => ({ ...p, id: e.currentTarget.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  烟雾警报
                  <select
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.smokeAlert ? 'true' : 'false'}
                    onChange={e => setSimForm(p => ({ ...p, smokeAlert: e.currentTarget.value === 'true' }))}
                  >
                    <option value="false">正常</option>
                    <option value="true">报警</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  电池电量 (%)
                  <input type="number" min={0} max={100}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.batteryPercent}
                    onInput={e => setSimForm(p => ({ ...p, batteryPercent: Number(e.currentTarget.value) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  环境温度 (℃)
                  <input type="number" step={0.1}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.temperature}
                    onInput={e => setSimForm(p => ({ ...p, temperature: Number(e.currentTarget.value) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  毫米波点云数
                  <input type="number" min={0}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.dotCnt}
                    onInput={e => setSimForm(p => ({ ...p, dotCnt: Number(e.currentTarget.value) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
                  检测人数
                  <input type="number" min={0}
                    className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={simForm.personCnt}
                    onInput={e => setSimForm(p => ({ ...p, personCnt: Number(e.currentTarget.value) }))}
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-primary" disabled={simSubmitting || !simForm.id.trim()} onClick={submitTerminalReport}>
                  {simSubmitting ? '上报中...' : '上报数据 → POST /api/terminal/report'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => {
                  setSimForm({ id: 'RP-DEMO', smokeAlert: false, batteryPercent: 85, temperature: 26.5, dotCnt: 42, personCnt: 3 });
                }}>填充示例数据</button>
                <button type="button" className="btn-danger" onClick={() => {
                  setSimForm(p => ({ ...p, smokeAlert: true, temperature: 78.3 }));
                }}>模拟火情</button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        船舶智能监控与火灾应急指挥系统 · VESSEL MONITORING & SAFETY SYSTEM
      </footer>
    </div>
  );
}
