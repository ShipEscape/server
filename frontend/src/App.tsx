import { useState, useEffect } from 'preact/hooks';
import './App.css';
import planImg from './assets/ship_floor_plan.webp';

interface MobileFireData {
  alert?: boolean | null;
  fireCenterX?: number | null;
  fireCenterY?: number | null;
  fireIntensity?: number | null;
}

interface TerminalInfo {
  smokeAlert?: boolean;
  batteryPercent?: number;
  temperature?: number;
  dotCnt?: number;
  personCnt?: number;
  thermalUrl?: string;
  [key: string]: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'fire' | 'terminal'>('home');

  // 主页 & 火灾状态
  const [mobileData, setMobileData] = useState<MobileFireData | null>(null);
  const [terminalCnt, setTerminalCnt] = useState<number | null>(null);
  const [homeLoading, setHomeLoading] = useState<boolean>(true);

  // 终端页面状态
  const [terminalList, setTerminalList] = useState<string[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null);
  const [terminalLoading, setTerminalLoading] = useState<boolean>(false);

  // 获取移动端/火灾数据
  const fetchMobileData = async () => {
    try {
      const res = await fetch('/api/mobile/data');
      if (res.ok) {
        const data = await res.json();
        setMobileData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 获取终端数量
  const fetchTerminalCnt = async () => {
    try {
      const res = await fetch('/api/terminal/cnt', { method: 'POST' });
      if (res.ok) {
        const cnt = await res.json();
        setTerminalCnt(cnt);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 获取终端列表
  const fetchTerminalList = async () => {
    try {
      const res = await fetch('/api/terminal/list', { method: 'POST' });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          setTerminalList(list);
          if (list.length > 0 && selectedTerminalId === null) {
            setSelectedTerminalId(list[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 获取指定终端信息
  const fetchTerminalInfo = async (id: string) => {
    setTerminalLoading(true);
    try {
      const res = await fetch(`/api/terminal/info/${id}`, { method: 'POST' });
      if (res.ok) {
        const info = await res.json();
        setTerminalInfo(info);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTerminalLoading(false);
    }
  };

  // 初次加载数据
  useEffect(() => {
    Promise.all([fetchMobileData(), fetchTerminalCnt()]).finally(() => {
      setHomeLoading(false);
    });
    fetchTerminalList();
  }, []);

  // 切换终端时加载信息
  useEffect(() => {
    if (selectedTerminalId !== null) {
      fetchTerminalInfo(selectedTerminalId);
    }
  }, [selectedTerminalId]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      {/* 顶部悬浮模糊菜单栏，左右两端半径50% */}
      <div className="top-navbar-container">
        <nav className="top-navbar">
          <button
            type="button"
            className={`nav-item-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            主页
          </button>
          <button
            type="button"
            className={`nav-item-btn ${activeTab === 'fire' ? 'active' : ''}`}
            onClick={() => setActiveTab('fire')}
          >
            火灾
          </button>
          <button
            type="button"
            className={`nav-item-btn ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            终端
          </button>
        </nav>
      </div>

      {/* 页面主体内容 */}
      <main className="page-container">
        {/* 主页 */}
        {activeTab === 'home' && (
          <section>
            <h1 className="section-title">系统状态总览</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div className="flat-card">
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>火灾警报状态</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {mobileData?.alert ? (
                    <span style={{ color: '#dc2626' }}>警报生效中（存在火灾）</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>安全正常（无火灾）</span>
                  )}
                </div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                  数据来源：/api/mobile/data 中的 alert
                </div>
              </div>

              <div className="flat-card">
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>终端计数</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>
                  {terminalCnt !== null ? terminalCnt : '--'}
                </div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
                  数据来源：/api/terminal/cnt 终端计数
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="custom-btn"
                onClick={() => {
                  fetchMobileData();
                  fetchTerminalCnt();
                }}
              >
                刷新主页数据
              </button>
            </div>
          </section>
        )}

        {/* 火灾 */}
        {activeTab === 'fire' && (
          <section>
            <h1 className="section-title">火灾监测详情与平面图定位</h1>

            {/* 火灾数据详细信息卡片 */}
            <div className="flat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '16px' }}>移动火灾全部数据</div>
                <button
                  type="button"
                  className="custom-btn"
                  onClick={fetchMobileData}
                >
                  刷新火灾数据
                </button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>属性名称</th>
                    <th>键名</th>
                    <th>当前数值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>火灾警报</td>
                    <td>alert</td>
                    <td style={{ fontWeight: 'bold', color: mobileData?.alert ? '#dc2626' : '#16a34a' }}>
                      {mobileData?.alert === true ? '是' : mobileData?.alert === false ? '否' : '未知'}
                    </td>
                  </tr>
                  <tr>
                    <td>火灾中心横坐标</td>
                    <td>fireCenterX</td>
                    <td>{mobileData?.fireCenterX !== undefined && mobileData?.fireCenterX !== null ? `${mobileData.fireCenterX} px` : '--'}</td>
                  </tr>
                  <tr>
                    <td>火灾中心纵坐标</td>
                    <td>fireCenterY</td>
                    <td>{mobileData?.fireCenterY !== undefined && mobileData?.fireCenterY !== null ? `${mobileData.fireCenterY} px` : '--'}</td>
                  </tr>
                  <tr>
                    <td>火灾强度</td>
                    <td>fireIntensity</td>
                    <td>{mobileData?.fireIntensity !== undefined && mobileData?.fireIntensity !== null ? mobileData.fireIntensity : '--'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 船舶平面图标注 */}
            <div className="flat-card">
              <div style={{ marginBottom: '12px', fontSize: '15px', fontWeight: '600', color: '#1e3a8a' }}>
                船舶平面图定位（坐标单位：像素）
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                底图原始分辨率：2056 × 1080 像素。火灾中心坐标已在图上标注。可横向滚动查看全图。
              </div>

              <div className="floor-plan-wrapper">
                <div className="floor-plan-inner">
                  <img
                    src={planImg.src || planImg}
                    alt="船舶平面图"
                    className="floor-plan-image"
                  />

                  {/* 如果存在坐标则标记火灾中心 */}
                  {mobileData?.fireCenterX !== undefined &&
                    mobileData?.fireCenterX !== null &&
                    mobileData?.fireCenterY !== undefined &&
                    mobileData?.fireCenterY !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${mobileData.fireCenterX}px`,
                          top: `${mobileData.fireCenterY}px`,
                        }}
                      >
                        <div className="fire-point-pulse" />
                        <div className="fire-point-marker">
                          <div className="fire-tooltip">
                            火灾中心 ({mobileData.fireCenterX}px, {mobileData.fireCenterY}px)
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 终端 */}
        {activeTab === 'terminal' && (
          <section>
            <h1 className="section-title">智能终端控制与信息</h1>

            {/* 终端选择切换条 */}
            <div className="flat-card">
              <div style={{ marginBottom: '12px', fontWeight: '600', color: '#1e3a8a' }}>
                切换智能终端（默认显示首个终端）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {terminalList.length > 0 ? (
                  terminalList.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`custom-btn ${selectedTerminalId === id ? 'active' : ''}`}
                      onClick={() => setSelectedTerminalId(id)}
                    >
                      终端 {id}
                    </button>
                  ))
                ) : (
                  <span style={{ color: '#64748b', fontSize: '14px' }}>暂无终端列表</span>
                )}
              </div>
            </div>

            {/* 当前终端详细数据 */}
            <div className="flat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '16px' }}>
                  终端 {selectedTerminalId !== null ? selectedTerminalId : '--'} 运行数据
                </div>
                {selectedTerminalId !== null && (
                  <button
                    type="button"
                    className="custom-btn"
                    onClick={() => fetchTerminalInfo(selectedTerminalId)}
                  >
                    刷新当前终端
                  </button>
                )}
              </div>

              {terminalLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  正在获取数据...
                </div>
              ) : terminalInfo ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>参数名称</th>
                      <th>键名</th>
                      <th>监测读数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>烟雾警报</td>
                      <td>smokeAlert</td>
                      <td style={{ fontWeight: 'bold', color: terminalInfo.smokeAlert ? '#dc2626' : '#16a34a' }}>
                        {terminalInfo.smokeAlert === true ? '警报触发' : '正常无烟'}
                      </td>
                    </tr>
                    <tr>
                      <td>剩余电量</td>
                      <td>batteryPercent</td>
                      <td>{terminalInfo.batteryPercent !== undefined ? `${terminalInfo.batteryPercent}%` : '--'}</td>
                    </tr>
                    <tr>
                      <td>环境温度</td>
                      <td>temperature</td>
                      <td>{terminalInfo.temperature !== undefined ? `${terminalInfo.temperature} ℃` : '--'}</td>
                    </tr>
                    <tr>
                      <td>红外光点计数</td>
                      <td>dotCnt</td>
                      <td>{terminalInfo.dotCnt !== undefined ? terminalInfo.dotCnt : '--'}</td>
                    </tr>
                    <tr>
                      <td>检测人员数量</td>
                      <td>personCnt</td>
                      <td>{terminalInfo.personCnt !== undefined ? `${terminalInfo.personCnt} 人` : '--'}</td>
                    </tr>
                    <tr>
                      <td>热成像监控链接</td>
                      <td>thermalUrl</td>
                      <td>
                        {terminalInfo.thermalUrl ? (
                          <a
                            href={terminalInfo.thermalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                          >
                            {terminalInfo.thermalUrl}
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  请选择终端以查看详情
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
