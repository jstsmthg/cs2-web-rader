import { useState, useEffect, useRef } from 'react'
import './App.css'

// Map scaling configurations (you will need to tune these for precise radar matching)
// CS:GO/CS2 map coordinates require scaling to fit 2D images.
// Format: mapName: { scale: number, x: number, y: number }
const MAP_CONFIGS = {
  ar_baggage: { scale: 2.539062, x: -1316, y: 1288 },
  ar_pool_day: { scale: 2.125, x: -1088, y: 1600 },
  ar_shoots: { scale: 2.6875, x: -1368, y: 1952 },
  cs_agency: { scale: 4.1817436, x: -2597.7368, y: 2079.3687 },
  cs_italy: { scale: 4.6, x: -2647, y: 2592 },
  cs_office: { scale: 4.1, x: -1838, y: 1858 },
  de_ancient: { scale: 5, x: -2953, y: 2164 },
  de_anubis: { scale: 5.22, x: -2796, y: 3328 },
  de_brewery: { scale: 2.1820312, x: -4122.4, y: 4394.4 },
  de_dust2: { scale: 4.4, x: -2476, y: 3239 },
  de_grail: { scale: 2.1756864, x: -4395.903, y: 4203.903 },
  de_inferno: { scale: 4.9, x: -2087, y: 3870 },
  de_jura: { scale: 2.504188, x: -2126.9092, y: 2389.8 },
  de_mirage: { scale: 5, x: -3230, y: 1713 },
  de_nuke: { scale: 7, x: -3453, y: 2887 },
  de_overpass: { scale: 5.2, x: -4831, y: 1781 },
  de_train: { scale: 4.082077, x: -2308, y: 2078 },
  de_vertigo: { scale: 4, x: -3168, y: 1762 },
  default: { scale: 5, x: 0, y: 0 }
};

function App() {
  const [wsUrl, setWsUrl] = useState('127.0.0.1:8080');
  const [pin, setPin] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  
  const [radarData, setRadarData] = useState({
    map: 'de_dust2',
    local: {},
    teammates: [],
    enemies: [],
    bomb: null
  });

  const wsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleConnect = (e) => {
    e.preventDefault();
    if (connecting) return;
    setConnecting(true);
    setError('');

    let url = wsUrl.trim();
    
    // Strip http:// or https:// and replace with ws:// or wss://
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      // If it's a raw ngrok URL without protocol, we should use wss:// for ngrok
      if (url.includes('ngrok-free.app') || url.includes('ngrok.app') || url.includes('ngrok.io')) {
        url = 'wss://' + url;
      } else {
        url = 'ws://' + url;
      }
    }
    
    // Remove trailing slash if present
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    // Append /radar if not already present
    if (!url.endsWith('/radar')) {
      url += '/radar';
    }
    
    // Add PIN to query string
    url += `?pin=${pin}`;

    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError('');
        
        // Setup keep-alive ping to prevent Ngrok/Mongoose from dropping idle connections
        ws.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setRadarData(data);
        } catch (err) {
          console.error("Failed to parse radar data:", err);
        }
      };

      ws.onerror = () => {
        setError("Connection failed. Check URL, PIN, and ensure Ngrok/Cheat is running.");
        setConnecting(false);
      };

      ws.onclose = () => {
        if (ws.pingInterval) clearInterval(ws.pingInterval);
        setConnected(false);
        setConnecting(false);
        setError("Disconnected from server.");
      };

      wsRef.current = ws;
    } catch (err) {
      setError("Invalid WebSocket URL.");
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      if (wsRef.current.pingInterval) clearInterval(wsRef.current.pingInterval);
      wsRef.current.close();
    }
  };

  // Convert game coordinates to radar pixel percentages (0% to 100%)
  const getRadarCoords = (x, y) => {
    const mapName = radarData.map;
    const cfg = MAP_CONFIGS[mapName] || MAP_CONFIGS.default;
    
    // X axis goes right, Y axis goes UP in game, but DOWN in image.
    const px = (x - cfg.x) / cfg.scale;
    const py = (cfg.y - y) / cfg.scale;
    
    // Assuming a 1024x1024 radar image mapping
    // Return as percentage to be responsive
    return {
      left: `${(px / 1024) * 100}%`,
      top: `${(py / 1024) * 100}%`
    };
  };

  if (!connected) {
    return (
      <div className="login-container">
        <div className="glass-panel login-box">
          <h1 className="title">CS2 Web Radar</h1>
          <p className="subtitle">Connect to your friend's radar</p>
          
          <form onSubmit={handleConnect}>
            <div className="input-group">
              <label>Ngrok URL / IP</label>
              <input 
                type="text" 
                value={wsUrl} 
                onChange={e => setWsUrl(e.target.value)}
                placeholder="e.g. 1a2b3c4d.ngrok.app"
                required
              />
            </div>
            
            <div className="input-group">
              <label>4-Digit PIN</label>
              <input 
                type="text" 
                value={pin} 
                onChange={e => setPin(e.target.value)}
                placeholder="1234"
                maxLength={4}
                required
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" disabled={connecting} className="connect-btn">
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Radar View ---

  // Check if map image exists, otherwise fallback to generic
  // We can use a raw github repo for radar images:
  const radarImageUrl = `https://raw.githubusercontent.com/2mlml/cs2-radar-images/master/${radarData.map}.png`;

  return (
    <div className="radar-container">
      <div className="radar-header glass-panel">
        <div className="status-indicator online"></div>
        <span>Live Radar - {radarData.map || "Unknown Map"}</span>
        <button className="disconnect-btn" onClick={handleDisconnect}>Disconnect</button>
      </div>

      <div className="radar-wrapper">
        <div className="radar-map" style={{ backgroundImage: `url(${radarImageUrl})` }}>
          
          {/* Teammates (Blue) */}
          {radarData.teammates && radarData.teammates.map((player, idx) => {
            const pos = getRadarCoords(player.x, player.y);
            return (
              <div key={`tm-${idx}`} className="dot teammate" style={{ left: pos.left, top: pos.top }}>
                <div className="hp-bar-bg"><div className="hp-bar-fg" style={{height: `${player.hp}%`}}></div></div>
                <div className="view-cone" style={{ transform: `rotate(${-player.yaw - 90}deg)` }}></div>
              </div>
            );
          })}

          {/* Local Player (Also Blue, as requested) */}
          {radarData.local && radarData.local.hp > 0 && (
            <div className="dot teammate local" style={{ 
              left: getRadarCoords(radarData.local.x, radarData.local.y).left, 
              top: getRadarCoords(radarData.local.x, radarData.local.y).top 
            }}>
              <div className="hp-bar-bg"><div className="hp-bar-fg" style={{height: `${radarData.local.hp}%`}}></div></div>
              <div className="view-cone" style={{ transform: `rotate(${-radarData.local.yaw - 90}deg)` }}></div>
            </div>
          )}

          {/* Enemies (Red) */}
          {radarData.enemies && radarData.enemies.map((player, idx) => {
            const pos = getRadarCoords(player.x, player.y);
            return (
              <div key={`en-${idx}`} className="dot enemy" style={{ left: pos.left, top: pos.top }}>
                <div className="hp-bar-bg"><div className="hp-bar-fg" style={{height: `${player.hp}%`}}></div></div>
                <div className="view-cone" style={{ transform: `rotate(${-player.yaw - 90}deg)` }}></div>
              </div>
            );
          })}

          {/* Bomb (Orange) */}
          {radarData.bomb && radarData.bomb.state && (
            <div className="dot bomb pulse" style={{ 
              left: getRadarCoords(radarData.bomb.x, radarData.bomb.y).left, 
              top: getRadarCoords(radarData.bomb.x, radarData.bomb.y).top 
            }}>
              C4
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

export default App;
