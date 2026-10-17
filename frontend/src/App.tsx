import { useEffect, useRef, useState } from 'preact/hooks';
import './App.css';
import planImg from './assets/ship_floor_plan.webp';

interface Terminal {
  online?: boolean; fireAlert?: boolean;
  isAc?: boolean | null; voltage?: number | null; batteryPercent?: number | null;
  personCnt?: number; dotCnt?: number; persons?: [number, number][];
  thermalAvg?: number | null; thermalMax?: number | null; thermalMin?: number | null; thermalCenter?: number | null;
}
interface FireData {
  alert?: boolean | null; fireCenterX?: number | null; fireCenterY?: number | null; fireIntensity?: number | null;
}

const get = async <T,>(url: string): Promise<T | null> => {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
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
      ws.onclose = () => { if (alive) timer = window.setTimeout(connect, 2000); };
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

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [ids, setIds] = useState<string[]>([]);
  const [infos, setInfos] = useState<Record<string, Terminal>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [fire, setFire] = useState<FireData>({});
  const [wsOk, setWsOk] = useState(false);
  const [range, setRange] = useState<number | 'custom'>(86400);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hist, setHist] = useState<Hist[]>([]);

  // 轮询终端列表与各终端最新数据
  useEffect(() => {
    const poll = async () => {
      const list = (await get<string[]>('/api/terminal/list')) ?? [];
      const rows = await Promise.all(list.map(async id =>
          [id, await get<Terminal>(`/api/terminal/info/${encodeURIComponent(id)}`)] as const));
      setIds(list);
      setInfos(Object.fromEntries(rows.filter(([, v]) => v)) as Record<string, Terminal>);
      setSel(s => s ?? list[0] ?? null);
      get<FireData>('/api/mobile/data').then(d => d && setFire(d));
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, []);

  // 服务器下发的火灾数据（WebSocket 实时推送）
  useEffect(() => {
    let ws: WebSocket, timer: number, alive = true;
    const connect = () => {
      ws = new WebSocket(wsUrl('/api/mobile/ws'));
      ws.onopen = () => setWsOk(true);
      ws.onmessage = e => { try { setFire(JSON.parse(e.data)); } catch { /* 忽略非 JSON */ } };
      ws.onclose = () => { setWsOk(false); if (alive) timer = window.setTimeout(connect, 3000); };
    };
    connect();
    return () => { alive = false; clearTimeout(timer); ws.close(); };
  }, []);

  // 历史记录查询
  const query = async () => {
    if (!sel) return;
    const sec = (v: number) => Math.floor(v / 1000);
    const end = range === 'custom' ? sec(new Date(to).getTime()) : sec(Date.now());
    const start = range === 'custom' ? sec(new Date(from).getTime()) : end - range;
    if (!(end > start)) return;
    setHist((await get<Hist[]>(`/api/terminal/history/${encodeURIComponent(sel)}?start=${start}&end=${end}`)) ?? []);
  };
  useEffect(() => { if (tab === 'history') query(); }, [tab, sel, range]);

  const t = sel ? infos[sel] : undefined;
  const live = ids.filter(id => infos[id]?.online);
  const smokeIds = ids.filter(id => infos[id]?.smokeAlert);
  const persons = live.reduce((s, id) => s + (infos[id].personCnt ?? 0), 0);
  const temps = live.map(id => infos[id].thermalMax).filter((v): v is number => v != null);
  const maxT = temps.length ? Math.max(...temps) : null;
  const bat = t?.batteryPercent;
  const batTone = bat == null ? '' : bat <= 20 ? 'bad' : bat <= 50 ? 'warn' : 'ok';

  const picker = (
      <nav className="tabs">
        {ids.map(id => (
            <button key={id} className={id === sel ? 'on' : ''} onClick={() => setSel(id)}>
              <span className={`mark ${infos[id]?.smokeAlert ? 'bad' : infos[id]?.online ? 'ok' : ''}`} />终端 {id}
            </button>
        ))}
        {!ids.length && <span className="mute">还没有终端上报数据</span>}
      </nav>
  );

  return (
      <div className="app">
        <div className="navwrap">
          <nav className="pill">
            {TABS.map(([k, label]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
            ))}
            <span className={wsOk ? 'ok' : 'mute'}>{wsOk ? '实时连接' : '已断开'}</span>
          </nav>
        </div>

        {(fire.alert || smokeIds.length > 0) && (
            <div className="banner" role="alert" onClick={() => setTab('fire')}>
              {fire.alert && '服务器下发火灾警报。'}
              {smokeIds.length > 0 && `终端 ${smokeIds.join('、')} 烟雾报警。`}
            </div>
        )}

        {tab === 'home' && (<>
          <div className="kpis">
            <div><span>火灾</span><b className={fire.alert ? 'bad' : 'ok'}>{fire.alert ? '警报中' : '正常'}</b></div>
            <div><span>在线终端</span><b>{live.length} / {ids.length}</b></div>
            <div><span>烟雾报警</span><b className={smokeIds.length ? 'bad' : 'ok'}>{smokeIds.length} 台</b></div>
            <div><span>检测人数</span><b>{persons}</b></div>
            <div><span>最高温</span><b className={(maxT ?? 0) > 60 ? 'warn' : ''}>{fmt(maxT, 1, '℃')}</b></div>
          </div>
          <section>
            <h2>终端概览 <small>点击一行查看详情</small></h2>
            <table className="fleet">
              <thead><tr><th>终端</th><th>状态</th><th>电量</th><th>供电</th><th>人数</th><th>最高温</th><th>烟雾</th></tr></thead>
              <tbody>
              {ids.map(id => {
                const i: Terminal = infos[id] ?? {};
                return (
                    <tr key={id} onClick={() => { setSel(id); setTab('terminal'); }}>
                      <td>{id}</td>
                      <td className={i.online ? 'ok' : 'mute'}>{i.online ? '在线' : '离线'}</td>
                      <td>{fmt(i.batteryPercent, 0, '%')}</td>
                      <td>{i.isAc == null ? '--' : i.isAc ? '市电' : '电池'}</td>
                      <td>{i.personCnt ?? '--'}</td>
                      <td>{fmt(i.thermalMax, 1, '℃')}</td>
                      <td className={i.smokeAlert ? 'bad' : 'ok'}>{i.smokeAlert ? '报警' : '正常'}</td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </section>
        </>)}

        {tab === 'fire' && (
            <main>
              <div className="col">
                <section>
                  <h2>船舶平面图 <small className={fire.alert ? 'bad' : 'ok'}>{fire.alert ? '警报中' : '全船正常'}</small></h2>
                  <div className="plan">
                    <img src={planImg.src || planImg} alt="船舶平面图" />
                    {fire.alert && fire.fireCenterX != null && fire.fireCenterY != null && (
                        <i className="fire" title={`强度 ${fire.fireIntensity ?? '--'}`}
                           style={{ left: `${(fire.fireCenterX / 2056) * 100}%`, top: `${(fire.fireCenterY / 1080) * 100}%` }} />
                    )}
                  </div>
                </section>
              </div>
              <div className="col">
                <section>
                  <h2>火灾数据 <small>服务器下发</small></h2>
                  <dl>
                    <Row k="火灾警报" v={fire.alert ? '是' : '否'} tone={fire.alert ? 'bad' : 'ok'} />
                    <Row k="火源位置 X" v={fmt(fire.fireCenterX, 0, ' px')} />
                    <Row k="火源位置 Y" v={fmt(fire.fireCenterY, 0, ' px')} />
                    <Row k="火灾强度" v={fmt(fire.fireIntensity, 2)} />
                  </dl>
                </section>
                <section>
                  <h2>终端烟雾报警 <small>{smokeIds.length} 台</small></h2>
                  <p className="coords">{smokeIds.length ? smokeIds.map(id => <span key={id}>终端 {id}</span>) : <span>暂无报警</span>}</p>
                </section>
              </div>
            </main>
        )}

        {tab === 'terminal' && (<>
          {picker}
          {sel && t ? (
              <main className={t.online ? '' : 'stale'}>
                <div className="col">
                  {!t.online && <p className="note">终端离线，以下为最后一次上报的数据。</p>}
                  <Thermal key={sel} id={sel} />
                </div>
                <div className="col">
                  <section>
                    <h2>终端 {sel}</h2>
                    <dl>
                      <Row k="烟雾" v={t.fireAlert ? '报警' : '正常'} tone={t.fireAlert ? 'bad' : 'ok'} />
                      <Row k="电量" v={fmt(bat, 0, '%')} tone={batTone} />
                      <div className={`bar ${batTone}`}><i style={{ width: `${bat ?? 0}%` }} /></div>
                      <Row k="电压" v={fmt(t.voltage, 2, ' V')} />
                      <Row k="供电" v={t.isAc == null ? '--' : t.isAc ? '市电' : '电池'} />
                      <Row k="人数" v={`${t.personCnt ?? 0} 人`} />
                      <Row k="毫米波点数" v={`${t.dotCnt ?? 0}`} />
                      <Row k="平均温度" v={fmt(t.thermalAvg, 1, '℃')} />
                      <Row k="最高温" v={fmt(t.thermalMax, 1, '℃')} tone={(t.thermalMax ?? 0) > 60 ? 'warn' : ''} />
                      <Row k="最低温" v={fmt(t.thermalMin, 1, '℃')} />
                      <Row k="中心温度" v={fmt(t.thermalCenter, 1, '℃')} />
                    </dl>
                  </section>
                  <Radar pts={t.persons ?? []} />
                </div>
              </main>
          ) : <p className="mute">请选择终端</p>}
        </>)}

        {tab === 'history' && (<>
          {picker}
          <div className="ctl">
            {RANGES.map(([label, s]) => (
                <button key={s} className={range === s ? 'on' : ''} onClick={() => setRange(s)}>{label}</button>
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
        </>)}
      </div>
  );
}
