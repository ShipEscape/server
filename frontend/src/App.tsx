import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import './App.css';
import planImg from './assets/ship_floor_plan.webp';

interface Terminal {
  online?: boolean; fireAlert?: boolean; x?: number | null; y?: number | null;
  isAc?: boolean | null; voltage?: number | null; batteryPercent?: number | null;
  personCnt?: number; dotCnt?: number; persons?: [number, number][];
  thermalAvg?: number | null; thermalMax?: number | null; thermalMin?: number | null; thermalCenter?: number | null;
}
interface FireData {
  alert?: boolean | null; fireCenterX?: number | null; fireCenterY?: number | null; fireIntensity?: number | null;
}

let notify: (m: string) => void = () => {};     // 由 App 注册：在标签栏下方弹出简短错误
const get = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url);
    if (!r.ok) { notify(`服务器返回 ${r.status}`); return null; }
    return await r.json();
  } catch { notify('无法连接服务器'); return null; }
};
const wsUrl = (p: string) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${p}`;
const fmt = (v?: number | null, d = 1, u = '') => (v == null ? '--' : v.toFixed(d) + u);

// 热成像色板：深蓝 → 紫 → 橙 → 白
const STOPS = [[0, 0, 20], [60, 0, 120], [200, 30, 90], [255, 140, 0], [255, 240, 120], [255, 255, 255]];
const heat = (t: number) => {
  const p = t * (STOPS.length - 1), i = Math.min(Math.floor(p), STOPS.length - 2), f = p - i;
  return STOPS[i].map((a, k) => a + (STOPS[i + 1][k] - a) * f);
};
const GRADIENT = `linear-gradient(90deg,${STOPS.map(s => `rgb(${s})`).join()})`;

/** 热成像实时画面。帧格式：<HHff 头(宽,高,最低温,最高温) + uint8 像素 */
function Thermal({ id }: { id: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState({ fps: 0, lo: 0, hi: 0 });

  useEffect(() => {
    let ws: WebSocket, timer: number, n = 0, lo = 0, hi = 0, alive = true;
    const connect = () => {
      ws = new WebSocket(wsUrl(`/api/terminal/view/${encodeURIComponent(id)}`));
      ws.binaryType = 'arraybuffer';
      ws.onmessage = e => {
        const c = cv.current;
        if (!c || typeof e.data === 'string') return;            // 文本是 ping 心跳
        const v = new DataView(e.data);
        const w = v.getUint16(0, true), h = v.getUint16(2, true);
        lo = v.getFloat32(4, true); hi = v.getFloat32(8, true);
        const px = new Uint8Array(e.data, 12, w * h);
        const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h);
        px.forEach((q, i) => img.data.set([...heat(q / 255), 255], i * 4));
        c.width = w; c.height = h; ctx.putImageData(img, 0, 0);
        n++;
      };
      ws.onclose = () => { if (alive) { notify('热成像连接已断开'); timer = window.setTimeout(connect, 2000); } };
    };
    connect();
    const tick = setInterval(() => { setLive({ fps: n, lo, hi }); n = 0; }, 1000);
    return () => { alive = false; clearTimeout(timer); clearInterval(tick); ws.close(); };
  }, [id]);

  return (
      <figure className="thermal">
        <canvas ref={cv} />
        <figcaption>
          <span>{live.fps ? `${live.fps} 帧/秒` : '等待画面'}</span>
          <span className="scale" style={{ background: GRADIENT }} />
          <span>{live.fps ? `${live.lo.toFixed(1)}℃ 至 ${live.hi.toFixed(1)}℃` : '--'}</span>
        </figcaption>
      </figure>
  );
}

/** 毫米波人员位置：传感器在顶部中心，横向 x 按传感器视角镜像显示，向下为距离 y */
function Radar({ pts }: { pts: [number, number][] }) {
  const R = Math.max(3, Math.ceil(Math.max(0, ...pts.map(([x, y]) => Math.max(Math.abs(x), y)))));
  return (
      <section>
        <h2>人员位置 <small>{pts.length} 人</small></h2>
        <svg viewBox="-104 -6 208 112" className="radar">
          {[1, 2, 3, 4].map(k => <circle key={k} r={k * 25} className="ring" />)}
          <line x1="0" y1="0" x2="0" y2="100" className="ring" />
          {[1, 2, 3, 4].map(k => <text key={k} x="3" y={k * 25 - 2} className="lbl">{(R * k / 4).toFixed(1)}m</text>)}
          {pts.map(([x, y], i) => (
              <g key={i} transform={`translate(${(-x / R) * 100} ${(y / R) * 100})`}>
                <circle r="3.5" className="pt" />
                <text y="-6" textAnchor="middle" className="lbl">{i + 1}</text>
              </g>
          ))}
          <circle r="3" className="sensor" />
        </svg>
        <p className="coords">
          {pts.map(([x, y], i) => <span key={i}>{i + 1} 号 横向 {x.toFixed(2)} 距离 {y.toFixed(2)}</span>)}
        </p>
      </section>
  );
}

const Row = ({ k, v, tone }: { k: string; v: string; tone?: string }) => (
    <div className={`row ${tone ?? ''}`}><dt>{k}</dt><dd>{v}</dd></div>
);

type Tab = 'home' | 'fire' | 'terminal' | 'history';
const TABS: [Tab, string][] = [['home', '主页'], ['fire', '火灾'], ['terminal', '智能终端'], ['history', '历史记录']];
const RANGES: [string, number][] = [['1 小时', 3600], ['6 小时', 21600], ['24 小时', 86400], ['7 天', 604800], ['30 天', 2592000]];

type Hist = { t: number; thermalAvg: number | null; voltage: number | null; batteryPercent: number | null; personCnt: number | null; isAc: number | null };
const p2 = (n: number) => String(n).padStart(2, '0');
const fmtT = (s: number, long: boolean) => {
  const d = new Date(s * 1000), hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return long ? `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${hm}` : hm;
};

/** 折线图：悬停查看数值；ac 为真时在背景标出市电供电时段 */
function Chart({ title, rows, k, unit, color, ac, stepped, digits = 1, domain }: {
  title: string; rows: Hist[]; k: 'thermalAvg' | 'voltage' | 'batteryPercent' | 'personCnt'; unit: string; color: string;
  ac?: boolean; stepped?: boolean; digits?: number; domain?: [number, number];
}) {
  const [hi, setHi] = useState<number | null>(null);
  const vals = rows.map(r => r[k]);
  const nums = vals.filter((v): v is number => v != null);
  if (!nums.length) return <section><h2>{title}</h2><p className="mute">这段时间没有数据</p></section>;

  const W = 600, H = 190, L = 46, R = 12, T = 10, B = 24;
  let lo = domain?.[0] ?? Math.min(...nums), up = domain?.[1] ?? Math.max(...nums);
  if (up - lo < 1e-6) { lo -= 1; up += 1; }
  const t0 = rows[0].t, t1 = rows[rows.length - 1].t, long = t1 - t0 > 2 * 86400;
  const X = (t: number) => L + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (up - lo)) * (H - T - B);

  let d = '', prev = false, py = 0;                       // 缺数据处断开，人数用阶梯线
  vals.forEach((v, i) => {
    if (v == null) { prev = false; return; }
    const x = X(rows[i].t), y = Y(v);
    d += prev ? (stepped ? `L${x} ${py}L${x} ${y}` : `L${x} ${y}`) : `M${x} ${y}`;
    prev = true; py = y;
  });
  const bands: [number, number][] = [];
  if (ac) rows.forEach((r, i) => {
    if ((r.isAc ?? 0) < 0.5) return;
    const a = X(r.t), b = X(rows[i + 1]?.t ?? r.t) + 1, last = bands[bands.length - 1];
    if (last && Math.abs(last[1] - a) < 1.5) last[1] = b; else bands.push([a, b]);
  });
  const move = (e: MouseEvent) => {
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    rows.forEach((r, i) => { if (Math.abs(X(r.t) - x) < Math.abs(X(rows[best].t) - x)) best = i; });
    setHi(best);
  };
  const h = hi != null ? rows[hi] : null;

  return (
      <section>
        <h2>{title} <small>{h
            ? `${fmtT(h.t, true)}　${fmt(h[k], digits, unit)}${ac && (h.isAc ?? 0) >= 0.5 ? '（市电）' : ''}`
            : `最低 ${fmt(Math.min(...nums), digits, unit)}　最高 ${fmt(Math.max(...nums), digits, unit)}`}</small></h2>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseMove={move} onMouseLeave={() => setHi(null)}>
          {bands.map(([a, b], i) => <rect key={i} x={a} y={T} width={Math.max(b - a, 2)} height={H - T - B} className="acband" />)}
          {[0, 1, 2, 3].map(i => {
            const v = lo + ((up - lo) * i) / 3;
            return <g key={i}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" className="ax">{v.toFixed(digits)}</text></g>;
          })}
          {[0, 1, 2, 3, 4].map(i => {
            const t = t0 + ((t1 - t0) * i) / 4;
            return <text key={i} x={X(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="ax">{fmtT(t, long)}</text>;
          })}
          <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
          {h && vals[hi!] != null && <>
            <line x1={X(h.t)} x2={X(h.t)} y1={T} y2={H - B} className="cursor" />
            <circle cx={X(h.t)} cy={Y(vals[hi!]!)} r="4" fill={color} />
          </>}
        </svg>
        {ac && <p className="legend"><i className="sw" />市电供电时段</p>}
      </section>
  );
}

type Sub = 'live' | 'pos';
const SUBS: [Sub, string][] = [['live', '实时数据'], ['pos', '终端位置']];
type HSub = 'curve' | 'alarm';
const HSUBS: [HSub, string][] = [['curve', '曲线'], ['alarm', '报警日志']];
interface Alarm { id: string; start: number; end: number | null; images: string[] }
const dur = (s: number) => s < 60 ? `${s} 秒` : s < 3600 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分`;
const PW = 2056, PH = 1080;                                  // 平面图原始分辨率
const at = (x: number, y: number) => ({ left: `${(x / PW) * 100}%`, top: `${(y / PH) * 100}%` });

/** 手机风格电池：充电时中间有闪电，图标和数字变绿 */
function Battery({ pct, ac }: { pct?: number | null; ac?: boolean | null }) {
  const tone = ac ? 'ok' : pct != null && pct <= 20 ? 'bad' : '';
  const w = (Math.max(0, Math.min(100, pct ?? 0)) / 100) * 22;
  return (
      <span className={`bat ${tone}`}>
      <svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="1" y="2" width="28" height="14" rx="3.5" />
        <path d="M31.5 7v4" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="4" y="5" width={w} height="8" rx="1.5" fill="currentColor" stroke="none" />
        {ac && <path d="M16.5 3.5 11.5 10h3.4l-1 4.5 5.2-7h-3.5z" fill="#fff" stroke="currentColor" strokeWidth=".8" strokeLinejoin="round" />}
      </svg>
      <b>{pct == null ? '--' : Math.round(pct)}%</b>
    </span>
  );
}

const Wifi = ({ ok }: { ok: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ok ? '#2f9e44' : '#e03131'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
      {!ok && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
);

/** 分段选择器：灰色胶囊在选项间平移，途中放大再缩小 */
function Seg<T extends string>({ items, value, onChange, className }: {
  items: [T, string][]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const box = useRef<HTMLDivElement>(null), ind = useRef<HTMLSpanElement>(null), prev = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const b = box.current?.querySelector<HTMLElement>('button.on'), i = ind.current;
      if (!b || !i) return;
      const l = b.offsetLeft, w = b.offsetWidth, p = prev.current;
      i.style.left = `${l}px`; i.style.width = `${w}px`;
      if (animate && p && (p[0] !== l || p[1] !== w)) i.animate([
        { left: `${p[0]}px`, width: `${p[1]}px`, transform: 'scale(1)' },
        { transform: 'scale(1.16, 1.14)', offset: 0.45 },
        { left: `${l}px`, width: `${w}px`, transform: 'scale(1)' },
      ], { duration: 520, easing: 'cubic-bezier(.45,.05,.2,1)' });
      prev.current = [l, w];
    };
    place(true);
    const onResize = () => place(false);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [value]);
  return (
      <div className={`seg ${className ?? ''}`} ref={box}>
        <span className="ind" ref={ind} />
        {items.map(([k, label]) => <button key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}
      </div>
  );
}

/** 船舶平面图；传入 onDrag 时，指针移动会回传图上坐标（像素） */
function Plan({ children, onDrag, onDrop }: { children?: any; onDrag?: (x: number, y: number) => void; onDrop?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onDrag!(Math.round(Math.min(PW, Math.max(0, ((e.clientX - r.left) / r.width) * PW))),
        Math.round(Math.min(PH, Math.max(0, ((e.clientY - r.top) / r.height) * PH))));
  };
  return (
      <div className="plan" ref={ref} onPointerMove={onDrag ? move : undefined} onPointerUp={onDrop}>
        <img src={planImg.src || planImg} alt="船舶平面图" draggable={false} />
        {children}
      </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sub, setSub] = useState<Sub>('live');
  const [hsub, setHsub] = useState<HSub>('curve');
  const [ids, setIds] = useState<string[]>([]);
  const [infos, setInfos] = useState<Record<string, Terminal>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [fire, setFire] = useState<FireData>({});
  const [wsOk, setWsOk] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [edit, setEdit] = useState<{ id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [range, setRange] = useState<number | 'custom'>(86400);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hist, setHist] = useState<Hist[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  useEffect(() => {                                       // 注册错误提示
    let timer: number;
    notify = m => { setToast(m); clearTimeout(timer); timer = window.setTimeout(() => setToast(null), 4000); };
  }, []);

  const poll = async () => {
    const list = await get<string[]>('/api/terminal/list');
    setApiOk(list !== null);
    if (!list) return;
    const rows = await Promise.all(list.map(async id =>
        [id, await get<Terminal>(`/api/terminal/info/${encodeURIComponent(id)}`)] as const));
    setIds(list);
    setInfos(Object.fromEntries(rows.filter(([, v]) => v)) as Record<string, Terminal>);
    setSel(s => s ?? list[0] ?? null);
    get<FireData>('/api/mobile/data').then(d => d && setFire(d));
  };
  useEffect(() => { poll(); const t = setInterval(poll, 2000); return () => clearInterval(t); }, []);

  useEffect(() => {                                       // 服务器下发的火灾数据
    let ws: WebSocket, timer: number, alive = true;
    const connect = () => {
      ws = new WebSocket(wsUrl('/api/mobile/ws'));
      ws.onopen = () => setWsOk(true);
      ws.onmessage = e => { try { setFire(JSON.parse(e.data)); } catch { /* 忽略非 JSON */ } };
      ws.onclose = () => { setWsOk(false); if (alive) { notify('火灾数据连接已断开'); timer = window.setTimeout(connect, 3000); } };
    };
    connect();
    return () => { alive = false; clearTimeout(timer); ws.close(); };
  }, []);

  const query = async () => {
    if (!sel) return;
    const sec = (v: number) => Math.floor(v / 1000);
    const end = range === 'custom' ? sec(new Date(to).getTime()) : sec(Date.now());
    const start = range === 'custom' ? sec(new Date(from).getTime()) : end - range;
    if (!(end > start)) return;
    setHist((await get<Hist[]>(`/api/terminal/history/${encodeURIComponent(sel)}?start=${start}&end=${end}`)) ?? []);
  };
  useEffect(() => { if (tab === 'history' && hsub === 'curve') query(); }, [tab, hsub, sel, range]);
  useEffect(() => {
    if (tab === 'history' && hsub === 'alarm') get<Alarm[]>('/api/terminal/alarms?limit=50').then(a => a && setAlarms(a));
  }, [tab, hsub]);

  const pos = (id: string): [number, number] | null =>
      edit?.id === id ? [edit.x, edit.y] : infos[id]?.x != null && infos[id]?.y != null ? [infos[id].x!, infos[id].y!] : null;
  const savePos = async () => {
    if (!edit) return;
    const r = await fetch(`/api/terminal/position/${encodeURIComponent(edit.id)}?x=${edit.x}&y=${edit.y}`, { method: 'POST' }).catch(() => null);
    if (!r?.ok) return notify(r ? `保存失败 ${r.status}` : '无法连接服务器');
    await poll();
    setEdit(null);
  };

  const t = sel ? infos[sel] : undefined;
  const live = ids.filter(id => infos[id]?.online);
  const fireIds = ids.filter(id => infos[id]?.fireAlert);
  const persons = live.reduce((n, id) => n + (infos[id].personCnt ?? 0), 0);
  const temps = live.map(id => infos[id].thermalMax).filter((v): v is number => v != null);
  const maxT = temps.length ? Math.max(...temps) : null;
  const connOk = apiOk && wsOk;
  const cur = sel ? pos(sel) : null;

  const picker = (
      <nav className="tabs">
        {ids.map(id => (
            <button key={id} className={id === sel ? 'on' : ''} onClick={() => setSel(id)}>
              <span className={`mark ${infos[id]?.fireAlert ? 'bad' : infos[id]?.online ? 'ok' : ''}`} />终端 {id}
            </button>
        ))}
        {!ids.length && <span className="mute">还没有终端上报数据</span>}
      </nav>
  );

  return (
      <div className="app">
        <div className="navwrap"><div className="pill"><Seg items={TABS} value={tab} onChange={setTab} /></div></div>
        <span className="conn" title={connOk ? '连接正常' : '连接异常'}><Wifi ok={connOk} /></span>
        {toast && <div className="toast" role="status">{toast}</div>}

        {(fire.alert || fireIds.length > 0) && (
            <div className="banner" role="alert" onClick={() => setTab('fire')}>
              {fireIds.length ? `终端 ${fireIds.join('、')} 检测到火情` : '服务器下发火灾警报'}，点击查看位置
            </div>
        )}

        {tab === 'home' && (<>
          <div className="stats">
            <div><span>火情</span><b className={fire.alert ? 'bad' : 'ok'}>{fire.alert ? '警报中' : '正常'}</b></div>
            <div><span>在线终端</span><b>{live.length}<small> / {ids.length}</small></b></div>
            <div><span>检测人数</span><b>{persons}</b></div>
            <div><span>最高温</span><b className={(maxT ?? 0) > 60 ? 'warn' : ''}>{fmt(maxT, 1, '℃')}</b></div>
          </div>
          <div className="cards">
            {ids.map(id => {
              const i: Terminal = infos[id] ?? {};
              return (
                  <button key={id} className={`card ${i.fireAlert ? 'bad' : ''}`} onClick={() => { setSel(id); setTab('terminal'); }}>
                    <span className="cid"><i className={`mark ${i.fireAlert ? 'bad' : i.online ? 'ok' : ''}`} />终端 {id}</span>
                    <Battery pct={i.batteryPercent} ac={i.isAc} />
                    <span className="kv"><b>{i.personCnt ?? '--'}</b> 人</span>
                    <span className="kv"><b>{fmt(i.thermalMax, 1)}</b> ℃</span>
                    <em className={i.fireAlert ? 'bad' : i.online ? 'ok' : 'mute'}>{i.fireAlert ? '火情告警' : i.online ? '正常' : '离线'}</em>
                  </button>
              );
            })}
          </div>
        </>)}

        {tab === 'fire' && (
            <main>
              <div className="col">
                <section>
                  <h2>船舶平面图 <small className={fire.alert ? 'bad' : 'ok'}>{fire.alert ? '警报中' : '全船正常'}</small></h2>
                  <Plan>
                    {ids.map(id => { const p = pos(id); return p && (
                        <span key={id} className={`pin ${infos[id]?.fireAlert ? 'bad' : ''}`} style={at(p[0], p[1])}>{id}</span>
                    ); })}
                    {fire.alert && fire.fireCenterX != null && fire.fireCenterY != null && (
                        <i className="fire" style={at(fire.fireCenterX, fire.fireCenterY)} title={`强度 ${fire.fireIntensity ?? '--'}`} />
                    )}
                  </Plan>
                </section>
              </div>
              <div className="col">
                <section>
                  <h2>火灾数据 <small>服务器下发</small></h2>
                  <dl>
                    <Row k="状态" v={fire.alert ? '警报中' : '正常'} tone={fire.alert ? 'bad' : 'ok'} />
                    <Row k="火源坐标" v={fire.alert && fire.fireCenterX != null ? `${fire.fireCenterX}, ${fire.fireCenterY}` : '--'} />
                    <Row k="强度" v={fmt(fire.fireIntensity, 2)} />
                  </dl>
                </section>
              </div>
            </main>
        )}

        {tab === 'terminal' && (<>
          {picker}
          <Seg className="sub" items={SUBS} value={sub} onChange={setSub} />

          {sub === 'live' && (sel && t ? (
              <main className={t.online ? '' : 'stale'}>
                <div className="col">
                  {!t.online && <p className="note">终端离线，以下为最后一次上报的数据。</p>}
                  <Thermal key={sel} id={sel} />
                </div>
                <div className="col">
                  <section>
                    <div className={`verdict ${t.fireAlert ? 'bad' : 'ok'}`}>{t.fireAlert ? '检测到火情' : '未发现火情'}</div>
                    <Battery pct={t.batteryPercent} ac={t.isAc} />
                    <div className="stats two">
                      <div><b>{t.personCnt ?? 0}</b><span>人</span></div>
                      <div><b className={(t.thermalMax ?? 0) > 60 ? 'warn' : ''}>{fmt(t.thermalMax, 1)}</b><span>℃ 最高温</span></div>
                    </div>
                    <button className="link" onClick={() => setMore(true)}>详细信息</button>
                  </section>
                  <Radar pts={t.persons ?? []} />
                </div>
              </main>
          ) : <p className="mute">请选择终端</p>)}

          {sub === 'pos' && (
              <main>
                <div className="col">
                  <section>
                    <h2>平面图 <small>拖动标记调整位置</small></h2>
                    <Plan onDrag={(x, y) => drag && setEdit({ id: drag, x, y })} onDrop={() => setDrag(null)}>
                      {ids.map(id => { const p = pos(id); return p && (
                          <span key={id} className={`pin drag ${id === sel ? 'on' : ''} ${infos[id]?.fireAlert ? 'bad' : ''}`} style={at(p[0], p[1])}
                                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setSel(id); setDrag(id); setEdit({ id, x: p[0], y: p[1] }); }}>{id}</span>
                      ); })}
                    </Plan>
                  </section>
                </div>
                <div className="col">
                  <section>
                    <h2>终端 {sel ?? '--'} 坐标 <small>单位 px</small></h2>
                    <div className="ctl">
                      <label>X <input type="number" min={0} max={PW} value={cur?.[0] ?? ''}
                                      onInput={e => sel && setEdit({ id: sel, x: Number(e.currentTarget.value), y: cur?.[1] ?? 0 })} /></label>
                      <label>Y <input type="number" min={0} max={PH} value={cur?.[1] ?? ''}
                                      onInput={e => sel && setEdit({ id: sel, x: cur?.[0] ?? 0, y: Number(e.currentTarget.value) })} /></label>
                    </div>
                    <div className="ctl">
                      <button className="go" disabled={!edit} onClick={savePos}>保存位置</button>
                      {edit && <button onClick={() => setEdit(null)}>撤销修改</button>}
                    </div>
                    <p className="coords"><span>终端报警时，服务器会把火源坐标设为该终端的位置。</span></p>
                  </section>
                </div>
              </main>
          )}
        </>)}

        {tab === 'history' && (<>
          <Seg className="sub" items={HSUBS} value={hsub} onChange={setHsub} />
          {hsub === 'curve' ? (<>
            {picker}
            <div className="ctl">
              {RANGES.map(([label, sec]) => (
                  <button key={sec} className={range === sec ? 'on' : ''} onClick={() => setRange(sec)}>{label}</button>
              ))}
              <button className={range === 'custom' ? 'on' : ''} onClick={() => setRange('custom')}>自定义</button>
              {range === 'custom' && <>
                <input type="datetime-local" value={from} onInput={e => setFrom(e.currentTarget.value)} />至
                <input type="datetime-local" value={to} onInput={e => setTo(e.currentTarget.value)} />
              </>}
              <button className="go" onClick={query}>查询</button>
            </div>
            <div className="charts">
              <Chart title="电量" rows={hist} k="batteryPercent" unit="%" color="#1f6f78" ac digits={0} domain={[0, 100]} />
              <Chart title="电压" rows={hist} k="voltage" unit=" V" color="#b7791f" ac digits={2} />
              <Chart title="热成像平均温度" rows={hist} k="thermalAvg" unit="℃" color="#d9480f" />
              <Chart title="人数" rows={hist} k="personCnt" unit=" 人" color="#14232f" stepped digits={0}
                     domain={[0, Math.max(3, ...hist.map(r => r.personCnt ?? 0))]} />
            </div>
          </>) : (
              <section>
                <h2>报警日志 <small>最近 {alarms.length} 次</small></h2>
                {!alarms.length && <p className="mute">暂无报警记录</p>}
                {alarms.map((a, i) => (
                    <div className="alarm" key={i}>
                      <div>
                        <b>终端 {a.id}</b>
                        <p>{fmtT(a.start, true)} 至 {a.end ? fmtT(a.end, a.end - a.start > 43200) : '进行中'}
                          {a.end ? `（持续 ${dur(a.end - a.start)}）` : ''}</p>
                      </div>
                      <div className="thumbs">
                        {a.images.map(p => <a key={p} href={`/snapshots/${p}`} target="_blank"><img className="thumb" src={`/snapshots/${p}`} alt="热成像" /></a>)}
                      </div>
                    </div>
                ))}
              </section>
          )}
        </>)}

        {more && t && (
            <div className="veil" onClick={() => setMore(false)}>
              <div className="pop" onClick={e => e.stopPropagation()}>
                <h2>终端 {sel} 详细信息 <button className="link" onClick={() => setMore(false)}>关闭</button></h2>
                <dl>
                  <Row k="状态" v={t.online ? '在线' : '离线'} tone={t.online ? 'ok' : ''} />
                  <Row k="火情告警" v={t.fireAlert ? '是' : '否'} tone={t.fireAlert ? 'bad' : 'ok'} />
                  <Row k="电量" v={fmt(t.batteryPercent, 0, '%')} />
                  <Row k="电压" v={fmt(t.voltage, 2, ' V')} />
                  <Row k="供电" v={t.isAc == null ? '--' : t.isAc ? '市电充电' : '电池'} />
                  <Row k="人数" v={`${t.personCnt ?? 0} 人`} />
                  <Row k="毫米波点数" v={`${t.dotCnt ?? 0}`} />
                  <Row k="平均温度" v={fmt(t.thermalAvg, 1, '℃')} />
                  <Row k="最高温" v={fmt(t.thermalMax, 1, '℃')} />
                  <Row k="最低温" v={fmt(t.thermalMin, 1, '℃')} />
                  <Row k="中心温度" v={fmt(t.thermalCenter, 1, '℃')} />
                  <Row k="平面图位置" v={t.x != null && t.y != null ? `${t.x}, ${t.y}` : '未设置'} />
                </dl>
                {!!t.persons?.length && (
                    <p className="coords">{t.persons.map(([x, y], i) => <span key={i}>{i + 1} 号 横向 {x.toFixed(2)} 距离 {y.toFixed(2)}</span>)}</p>
                )}
              </div>
            </div>
        )}
      </div>
  );
}
