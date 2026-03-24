// frontend/src/pages/SettingsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  RiUserSettingsLine, RiTrophyLine, RiBellLine, RiPaletteLine, RiCpuLine,
  RiDatabaseLine, RiInformationLine,
  RiUserLine, RiMailLine, RiPhoneLine, RiBuildingLine, RiMapPinLine, RiCalendarLine,
  RiMailSendLine, RiCalendarCheckLine, RiMoneyDollarCircleLine,
  RiAlertLine, RiTimeLine, RiSparklingLine, RiVolumeUpLine,
  RiKeyLine, RiRobotLine, RiServerLine, RiPlugLine,
  RiLinkedinBoxLine,
  RiSaveLine, RiDownload2Line, RiDeleteBinLine, RiRefreshLine,
  RiExternalLinkLine, RiBug2Line, RiKeyboardLine, RiGithubLine,
  RiTerminalLine, RiEyeLine, RiEyeOffLine, RiCheckLine, RiLayoutLine,
  RiShieldUserLine, RiContrastLine, RiFileCodeLine, RiSettings3Line,
  RiCodeLine, RiMicLine, RiBrainLine, RiGlobalLine,
} from 'react-icons/ri';
import './SettingsPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ── localStorage hook ────────────────────────────────────────────────────────
function useSetting(key, defaultValue) {
  const [val, setVal] = useState(() => {
    const s = localStorage.getItem(key);
    if (s === null) return defaultValue;
    if (typeof defaultValue === 'boolean') return s === 'true';
    if (typeof defaultValue === 'number') return Number(s) || defaultValue;
    return s;
  });
  const save = useCallback((newVal) => {
    setVal(newVal);
    localStorage.setItem(key, String(newVal));
  }, [key]);
  return [val, save];
}

// ── Reusable primitives ──────────────────────────────────────────────────────
function SettingToggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={`setting-toggle${value ? ' on' : ''}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span className="setting-toggle-thumb" />
    </button>
  );
}

function SettingRow({ label, description, icon: Icon, children }) {
  return (
    <div className="setting-row">
      <div className="setting-row-left">
        <div className="setting-label">
          {Icon && <Icon size={13} style={{ marginRight: 6, color: '#64748b', flexShrink: 0 }} />}
          {label}
        </div>
        {description && <div className="setting-desc">{description}</div>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function SettingCard({ title, children }) {
  return (
    <div className="settings-card">
      {title && <div className="settings-group-title">{title}</div>}
      {children}
    </div>
  );
}

function SavedFlash({ show }) {
  return (
    <span className={`settings-saved-flash${show ? ' visible' : ''}`}>
      <RiCheckLine size={11} /> Saved
    </span>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="setting-password-wrap">
      <input
        type={show ? 'text' : 'password'}
        className="setting-input setting-input-wide"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Not configured'}
        autoComplete="off"
      />
      <button type="button" className="setting-password-toggle" onClick={() => setShow(s => !s)}>
        {show ? <RiEyeOffLine size={14} /> : <RiEyeLine size={14} />}
      </button>
    </div>
  );
}

// ── Danger button with inline confirmation ───────────────────────────────────
function DangerButton({ label, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [timer, setTimer] = useState(null);

  const handleClick = () => {
    if (confirming) {
      clearTimeout(timer);
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
      const t = setTimeout(() => setConfirming(false), 3500);
      setTimer(t);
    }
  };

  return (
    <button
      type="button"
      className={`btn-danger${confirming ? ' confirming' : ''}`}
      onClick={handleClick}
    >
      {confirming ? 'Confirm?' : label}
    </button>
  );
}

// ── Section components ───────────────────────────────────────────────────────

function ProfileSection() {
  const [name,      setName]      = useSetting('sdr_profile_name',      '');
  const [email,     setEmail]     = useSetting('sdr_profile_email',     '');
  const [phone,     setPhone]     = useSetting('sdr_profile_phone',     '');
  const [title,     setTitle]     = useSetting('sdr_profile_title',     'SDR');
  const [territory, setTerritory] = useSetting('sdr_profile_territory', '');
  const [team,      setTeam]      = useSetting('sdr_profile_team',      '');
  const [bio,       setBio]       = useSetting('sdr_profile_bio',       '');
  const [saved,     setSaved]     = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const field = (setter) => (e) => { setter(e.target.value); flash(); };

  return (
    <>
      <SettingCard title="Identity">
        <SettingRow label="Full Name" icon={RiUserLine}>
          <input className="setting-input setting-input-wide" value={name} onChange={field(setName)} placeholder="Your name" />
        </SettingRow>
        <SettingRow label="Job Title" description="Shown on call prep sheets" icon={RiShieldUserLine}>
          <input className="setting-input setting-input-wide" value={title} onChange={field(setTitle)} placeholder="SDR" />
        </SettingRow>
        <SettingRow label="Territory / Region" icon={RiMapPinLine}>
          <input className="setting-input setting-input-wide" value={territory} onChange={field(setTerritory)} placeholder="e.g. West Coast SMB" />
        </SettingRow>
        <SettingRow label="Team" icon={RiBuildingLine}>
          <input className="setting-input setting-input-wide" value={team} onChange={field(setTeam)} placeholder="e.g. Flexport Enterprise" />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Contact">
        <SettingRow label="Work Email" icon={RiMailLine}>
          <input className="setting-input setting-input-wide" type="email" value={email} onChange={field(setEmail)} placeholder="you@flexport.com" />
        </SettingRow>
        <SettingRow label="Phone" icon={RiPhoneLine}>
          <input className="setting-input setting-input-wide" type="tel" value={phone} onChange={field(setPhone)} placeholder="+1 (555) 000-0000" />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Bio / Notes">
        <textarea
          className="setting-input setting-textarea"
          value={bio}
          onChange={field(setBio)}
          placeholder="Territories, focus verticals, notes..."
          rows={4}
        />
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

function QuotaSection() {
  const [calls,    setCalls]    = useSetting('sdr_quota_calls',    50);
  const [emails,   setEmails]   = useSetting('sdr_quota_emails',   100);
  const [demos,    setDemos]    = useSetting('sdr_quota_demos',    5);
  const [linkedin, setLinkedin] = useSetting('sdr_quota_linkedin', 20);
  const [revenue,  setRevenue]  = useSetting('sdr_quota_revenue',  0);
  const [saved,    setSaved]    = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const numField = (setter) => (e) => {
    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
    setter(v); flash();
  };

  const callPct     = Math.min(100, Math.round((22 / calls)    * 100));
  const emailPct    = Math.min(100, Math.round((47 / emails)   * 100));
  const demoPct     = Math.min(100, Math.round((2  / demos)    * 100));
  const linkedinPct = Math.min(100, Math.round((8  / linkedin) * 100));

  return (
    <>
      <SettingCard title="Weekly Activity Targets">
        <SettingRow label="Call Target" description="Dials per week" icon={RiPhoneLine}>
          <input className="setting-input setting-number" type="number" min="1" value={calls} onChange={numField(setCalls)} />
        </SettingRow>
        <SettingRow label="Email Target" description="Outbound emails per week" icon={RiMailSendLine}>
          <input className="setting-input setting-number" type="number" min="1" value={emails} onChange={numField(setEmails)} />
        </SettingRow>
        <SettingRow label="Demo Target" description="Demos booked per week" icon={RiCalendarCheckLine}>
          <input className="setting-input setting-number" type="number" min="1" value={demos} onChange={numField(setDemos)} />
        </SettingRow>
        <SettingRow label="LinkedIn Target" description="LinkedIn messages per week" icon={RiLinkedinBoxLine}>
          <input className="setting-input setting-number" type="number" min="1" value={linkedin} onChange={numField(setLinkedin)} />
        </SettingRow>
        <SettingRow label="Pipeline Target" description="Revenue goal ($)" icon={RiMoneyDollarCircleLine}>
          <input className="setting-input setting-number" type="number" min="0" step="1000" value={revenue} onChange={(e) => { setRevenue(parseInt(e.target.value,10)||0); flash(); }} />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Quota Preview">
        <div className="quota-preview-note">Based on hypothetical mid-week progress (22 calls / 47 emails / 2 demos)</div>
        {[
          { label: 'Calls',    pct: callPct,     color: '#00d4ff', val: 22, target: calls    },
          { label: 'Emails',   pct: emailPct,    color: '#8b5cf6', val: 47, target: emails   },
          { label: 'Demos',    pct: demoPct,     color: '#10b981', val: 2,  target: demos    },
          { label: 'LinkedIn', pct: linkedinPct, color: '#f59e0b', val: 8,  target: linkedin },
        ].map(({ label, pct, color, val, target }) => (
          <div key={label} className="quota-prev-row">
            <span className="quota-prev-label">{label}</span>
            <div className="quota-prev-bar-bg">
              <div className="quota-prev-bar" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="quota-prev-val" style={{ color }}>{val}<span style={{ color: '#475569' }}>/{target}</span></span>
          </div>
        ))}
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

function NotificationsSection() {
  const [radar,     setRadar]     = useSetting('sdr_notif_radar',       true);
  const [radarDays, setRadarDays] = useSetting('sdr_notif_radar_days',  3);
  const [stale,     setStale]     = useSetting('sdr_notif_stale',       true);
  const [staleDays, setStaleDays] = useSetting('sdr_notif_stale_days',  7);
  const [signals,   setSignals]   = useSetting('sdr_notif_signals',     true);
  const [sound,     setSound]     = useSetting('sdr_notif_sound',       false);
  const [saved,     setSaved]     = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const tog = (setter) => (v) => { setter(v); flash(); };

  return (
    <>
      <SettingCard title="In-App Alerts">
        <SettingRow label="Follow-up Radar Alerts" description="Flag pipeline companies overdue for contact" icon={RiAlertLine}>
          <SettingToggle value={radar} onChange={tog(setRadar)} />
        </SettingRow>
        {radar && (
          <SettingRow label="Follow-up threshold" description="Days since last contact before a deal is flagged">
            <input
              className="setting-input setting-number"
              type="number" min="1" max="30"
              value={radarDays}
              onChange={e => { setRadarDays(Math.max(1, parseInt(e.target.value, 10) || 3)); flash(); }}
            />
          </SettingRow>
        )}
        <SettingRow label="Pipeline Stale Alerts" description="Warn when deals are stuck beyond threshold" icon={RiTimeLine}>
          <SettingToggle value={stale} onChange={tog(setStale)} />
        </SettingRow>
        {stale && (
          <SettingRow label="Stale threshold" description="Days before a deal is considered stuck">
            <input
              className="setting-input setting-number"
              type="number" min="1" max="90"
              value={staleDays}
              onChange={e => { setStaleDays(Math.max(1, parseInt(e.target.value,10)||7)); flash(); }}
            />
          </SettingRow>
        )}
        <SettingRow label="Signal Feed Alerts" description="Highlight high-urgency trade signals" icon={RiSparklingLine}>
          <SettingToggle value={signals} onChange={tog(setSignals)} />
        </SettingRow>
        <SettingRow label="Alert Sound" description="Play a chime for urgent signals" icon={RiVolumeUpLine}>
          <SettingToggle value={sound} onChange={tog(setSound)} />
        </SettingRow>
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

const ACCENT_PRESETS = [
  { color: '#00d4ff', label: 'Cyan (default)' },
  { color: '#a78bfa', label: 'Purple'          },
  { color: '#10b981', label: 'Emerald'         },
  { color: '#f59e0b', label: 'Amber'           },
  { color: '#ef4444', label: 'Red'             },
];

const GLOBE_TEXTURE_OPTS = [
  { value: 'blue-marble', label: 'Blue Marble', dot: '#1a6fa8' },
  { value: 'night',       label: 'Night',       dot: '#0d1f3c' },
];

function AppearanceSection() {
  const [accent,       setAccent]       = useSetting('sdr_ui_accent',              '#00d4ff');
  const [sidebar,      setSidebar]      = useSetting('sdr_ui_sidebar_default',     'collapsed');
  const [animations,   setAnimations]   = useSetting('sdr_ui_animations',          true);
  const [density,      setDensity]      = useSetting('sdr_ui_density',             'normal');
  const [homeTexture,  setHomeTexture]  = useSetting('sdr_globe_texture_home',     'blue-marble');
  const [oceanTexture, setOceanTexture] = useSetting('sdr_globe_texture_ocean',    'night');
  const [airTexture,   setAirTexture]   = useSetting('sdr_globe_texture_air',      'night');
  const [landTexture,  setLandTexture]  = useSetting('sdr_globe_texture_land',     'night');
  const [saved,        setSaved]        = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <>
      <SettingCard title="Accent Color">
        <div className="accent-swatches">
          {ACCENT_PRESETS.map(({ color, label }) => (
            <button
              key={color}
              type="button"
              className={`accent-swatch${accent === color ? ' selected' : ''}`}
              style={{ background: color }}
              title={label}
              onClick={() => {
                setAccent(color);
                flash();
                const r = parseInt(color.slice(1, 3), 16) || 0;
                const g = parseInt(color.slice(3, 5), 16) || 212;
                const b = parseInt(color.slice(5, 7), 16) || 255;
                document.documentElement.style.setProperty('--accent', color);
                document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
              }}
            />
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Layout">
        <SettingRow label="Sidebar default" description="Expanded or collapsed on load" icon={RiLayoutLine}>
          <select
            className="setting-input setting-select"
            value={sidebar}
            onChange={e => {
              setSidebar(e.target.value);
              flash();
              window.dispatchEvent(new StorageEvent('storage', { key: 'sdr_ui_sidebar_default', newValue: e.target.value }));
            }}
          >
            <option value="collapsed">Collapsed</option>
            <option value="expanded">Expanded</option>
          </select>
        </SettingRow>
        <SettingRow label="Dashboard Density" description="Adjust spacing between panels" icon={RiContrastLine}>
          <select
            className="setting-input setting-select"
            value={density}
            onChange={e => {
              setDensity(e.target.value);
              flash();
              document.documentElement.setAttribute('data-density', e.target.value);
            }}
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="spacious">Spacious</option>
          </select>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Animations">
        <SettingRow label="KPI Count-up Animation" description="Animate numbers on page load" icon={RiSparklingLine}>
          <SettingToggle value={animations} onChange={(v) => { setAnimations(v); flash(); }} />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Globe Textures">
        <div className="setting-desc" style={{ marginBottom: 12 }}>
          Choose the map texture displayed on each 3D globe. Changes apply when you navigate to that page.
        </div>
        {[
          { label: 'Home',          val: homeTexture,  setter: setHomeTexture,  storageKey: 'sdr_globe_texture_home'  },
          { label: 'Ocean Freight', val: oceanTexture, setter: setOceanTexture, storageKey: 'sdr_globe_texture_ocean' },
          { label: 'Air Freight',   val: airTexture,   setter: setAirTexture,   storageKey: 'sdr_globe_texture_air'   },
          { label: 'Land Freight',  val: landTexture,  setter: setLandTexture,  storageKey: 'sdr_globe_texture_land'  },
        ].map(({ label, val, setter, storageKey }) => (
          <SettingRow key={label} label={label} icon={RiGlobalLine}>
            <div className="globe-texture-picker">
              {GLOBE_TEXTURE_OPTS.map(({ value, label: optLabel, dot }) => (
                <button
                  key={value}
                  type="button"
                  className={`globe-texture-opt${val === value ? ' selected' : ''}`}
                  onClick={() => {
                    setter(value);
                    flash();
                    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: value }));
                  }}
                >
                  <span className="globe-texture-dot" style={{ background: dot }} />
                  {optLabel}
                </button>
              ))}
            </div>
          </SettingRow>
        ))}
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

function IntegrationsSection({ health, onTestHealth, healthLoading }) {
  const [openaiKey,  setOpenaiKey]  = useSetting('sdr_ai_openai_key',  '');
  const [newsKey,    setNewsKey]    = useSetting('sdr_int_news_key',    '');
  const [fxKey,      setFxKey]      = useSetting('sdr_int_fx_key',      '');
  const [serperKey,  setSerperKey]  = useSetting('sdr_int_serper_key',  '');
  const [fredKey,    setFredKey]    = useSetting('sdr_int_fred_key',    '');
  const [model,      setModel]      = useSetting('sdr_ai_model',        'gpt-4.1-mini');
  const [aiEnabled,  setAiEnabled]  = useSetting('sdr_ai_enabled',      true);
  const [saved,      setSaved]      = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const envStatus = (key) => {
    if (!health) return null;
    const ok = health.env?.[key];
    return (
      <span className={`env-badge${ok ? ' ok' : ' missing'}`}>
        {ok ? 'Configured' : 'Not set'}
      </span>
    );
  };

  return (
    <>
      <SettingCard title="Backend Connection">
        <div className="health-card">
          <div className="health-card-row">
            <span className="health-card-label">API Server</span>
            <div className="health-status">
              {health ? (
                <>
                  <span className={`health-dot ${health.status === 'ok' ? 'ok' : 'error'}`} />
                  <span className="health-label">{health.status === 'ok' ? 'Online' : 'Unreachable'}</span>
                </>
              ) : (
                <span className="health-label muted">—</span>
              )}
            </div>
          </div>
          {health && (
            <>
              <div className="health-card-row">
                <span className="health-card-label">Version</span>
                <span className="health-label mono">{health.version}</span>
              </div>
              <div className="health-card-row">
                <span className="health-card-label">Last checked</span>
                <span className="health-label mono">{new Date(health.timestamp).toLocaleTimeString()}</span>
              </div>
            </>
          )}
          <button
            type="button"
            className="btn-accent-sm"
            onClick={onTestHealth}
            disabled={healthLoading}
          >
            {healthLoading ? 'Testing...' : <><RiPlugLine size={12} /> Test Connection</>}
          </button>
        </div>
      </SettingCard>

      <SettingCard title="API Key Status (Server-side)">
        <div className="setting-desc" style={{ marginBottom: 12 }}>
          Keys are set via backend environment variables. Status reflects whether each is currently configured on the server.
        </div>
        {[
          { label: 'OpenAI',                key: 'openai',       icon: RiRobotLine,    desc: 'All AI features'                     },
          { label: 'NewsAPI',               key: 'newsapi',      icon: RiFileCodeLine, desc: 'Supply chain signals feed'           },
          { label: 'FRED',                  key: 'fred',         icon: RiServerLine,   desc: 'Macro trade data + indices'          },
          { label: 'ExchangeRate API',       key: 'exchangeRate', icon: RiKeyLine,      desc: 'Live FX rates'                       },
          { label: 'Serper',                key: 'serper',       icon: RiCodeLine,     desc: 'Company research enrichment'         },
          { label: 'AISstream',             key: 'aisstream',    icon: RiGlobalLine,   desc: 'Live vessel positions (Ocean Freight)'},
          { label: 'Terminal49',            key: 'terminal49',   icon: RiServerLine,   desc: 'Container tracking'                  },
          { label: 'OpenSky (OAuth)',        key: 'opensky',      icon: RiPlugLine,     desc: 'Live cargo flight positions (Air Freight)'},
        ].map(({ label, key, icon: Icon, desc }) => (
          <SettingRow key={key} label={label} description={desc} icon={Icon}>
            {envStatus(key) || <span className="health-label muted">Run health check</span>}
          </SettingRow>
        ))}
      </SettingCard>

      <SettingCard title="AI Preferences">
        <SettingRow label="Enable AI Features" description="Powers prospect analysis, AI Message Composer, semantic search, signal scoring, live call suggestions, and research briefs" icon={RiCpuLine}>
          <SettingToggle value={aiEnabled} onChange={(v) => { setAiEnabled(v); flash(); }} />
        </SettingRow>
        <SettingRow label="Model Preference" description="Used for all AI features across the platform" icon={RiRobotLine}>
          <select
            className="setting-input setting-select"
            value={model}
            onChange={e => { setModel(e.target.value); flash(); }}
          >
            <option value="gpt-4.1-mini">gpt-4.1-mini (default — fast + cost-efficient)</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o (highest quality)</option>
            <option value="gpt-4.1">gpt-4.1</option>
          </select>
        </SettingRow>
      </SettingCard>

      <SettingCard title="AI Features Active on This Platform">
        {[
          { label: 'Prospect Analysis',      desc: 'Freight mix, urgency score, pain points, talking points — Account 360 + Home' },
          { label: 'AI Message Composer',    desc: 'Generate email + LinkedIn outreach by tone (direct / consultative / challenger)' },
          { label: 'Semantic Prospect Search', desc: 'Natural language → SQL: "electronics importers from Asia with high ICP"' },
          { label: 'Supply Chain Signals',   desc: 'NewsAPI articles scored 1–10 for outreach urgency, refreshed nightly at midnight EST' },
          { label: 'Signal Match',           desc: 'Maps a trade signal to affected sectors and generates talking points' },
          { label: 'Live Call AI',           desc: 'Real-time transcript analysis with suggested responses and objection predictions' },
          { label: 'Call Prep Brief',        desc: 'Pre-call intelligence package: context, openers, objections, questions' },
          { label: 'Objection Handler',      desc: 'Structured rebuttals for common freight forwarder objections' },
          { label: 'Call Intelligence',      desc: 'Parses call notes into pain points, signals, deal probability, and next steps' },
          { label: 'Research Brief',         desc: 'Company intelligence: trade profile, freight breakdown, why-now signals' },
          { label: 'MAP / Strategic Plan',   desc: 'Mutual Action Plan generator for Account 360 page' },
        ].map(({ label, desc }) => (
          <div key={label} className="setting-row" style={{ alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div className="setting-label" style={{ fontSize: 12 }}>{label}</div>
              <div className="setting-desc">{desc}</div>
            </div>
          </div>
        ))}
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

function DataSection() {
  const [autosave,   setAutosave]   = useSetting('sdr_data_autosave',   true);
  const [retention,  setRetention]  = useSetting('sdr_data_retention',  '365');
  const [exporting,  setExporting]  = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [saved,      setSaved]      = useState(false);
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const [perf, pipeline, analyses, prospects, winloss] = await Promise.all([
        fetch(`${API}/api/performance`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/pipeline`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/analyses`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/prospects?limit=1000`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/win-loss`).then(r => r.json()).catch(() => null),
      ]);
      const payload = { performance: perf, pipeline, analyses, prospects, winLoss: winloss, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flexport-sdr-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } finally {
      setExporting(false);
    }
  };

  const clearSettings = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sdr_'))
      .forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <>
      <SettingCard title="Data Preferences">
        <SettingRow label="Auto-save AI Analyses" description="Automatically persist streaming analyses to the database" icon={RiSaveLine}>
          <SettingToggle value={autosave} onChange={(v) => { setAutosave(v); flash(); }} />
        </SettingRow>
        <SettingRow label="Activity Retention" description="How long to keep logged activities" icon={RiTimeLine}>
          <select
            className="setting-input setting-select"
            value={retention}
            onChange={e => { setRetention(e.target.value); flash(); }}
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="all">All time</option>
          </select>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Export">
        <div className="setting-desc" style={{ marginBottom: 14 }}>
          Download all your data as a single JSON file — includes pipeline, prospects, analyses, activity log, and win/loss records.
        </div>
        <button
          type="button"
          className="btn-accent-sm export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            'Exporting...'
          ) : exportDone ? (
            <><RiCheckLine size={13} /> Exported</>
          ) : (
            <><RiDownload2Line size={13} /> Export All Data</>
          )}
        </button>
      </SettingCard>

      <div className="danger-zone">
        <div className="danger-zone-title"><RiAlertLine size={11} style={{ marginRight: 5 }} />Danger Zone</div>
        <div className="danger-actions">
          <div className="danger-action-row">
            <div>
              <div className="setting-label">Reset All Settings</div>
              <div className="setting-desc">Clears all local preferences and reloads the page</div>
            </div>
            <DangerButton label="Reset Settings" onConfirm={clearSettings} />
          </div>
          <div className="danger-action-row">
            <div>
              <div className="setting-label">Clear Pipeline Data</div>
              <div className="setting-desc">Removes all deals from the pipeline board</div>
            </div>
            <DangerButton label="Clear Pipeline" onConfirm={async () => {
              const res = await fetch(`${API}/api/pipeline`).then(r => r.json()).catch(() => ({}));
              const allDeals = Object.values(res || {}).flat().filter(d => d?.id);
              await Promise.all(allDeals.map(d => fetch(`${API}/api/pipeline/${d.id}`, { method: 'DELETE' })));
            }} />
          </div>
        </div>
      </div>

      <SavedFlash show={saved} />
    </>
  );
}

const API_ROUTES = [
  // Prospects
  { method: 'GET',    path: '/api/prospects',             desc: 'List prospects with sector/ICP/search filters'   },
  { method: 'GET',    path: '/api/prospects/:id',         desc: 'Single prospect detail'                          },
  { method: 'GET',    path: '/api/prospects/sectors',     desc: 'Distinct sectors + counts'                       },
  { method: 'GET',    path: '/api/hot-prospects',         desc: 'Top 8 by opportunity score'                      },
  { method: 'POST',   path: '/api/semantic-search',       desc: 'AI natural language → SQL prospect search'       },
  // AI — analysis & messaging
  { method: 'POST',   path: '/api/analyze',               desc: 'Prospect analysis stream (SSE) — freight mix, urgency, talking pts' },
  { method: 'POST',   path: '/api/compose-email',         desc: 'AI Message Composer stream (SSE) — email + LinkedIn by tone'        },
  { method: 'POST',   path: '/api/research',              desc: 'Company intelligence brief — trade profile, signals, why-now'       },
  { method: 'POST',   path: '/api/call-prep',             desc: 'Pre-call AI brief — context, openers, objections, questions'        },
  { method: 'POST',   path: '/api/objection',             desc: 'Objection handler — structured freight rebuttals'                   },
  { method: 'POST',   path: '/api/call-intelligence',     desc: 'Parse call notes → pain points, deal probability, next steps'       },
  { method: 'POST',   path: '/api/signal-match',          desc: 'Map trade signal to affected sectors + talking points'              },
  { method: 'POST',   path: '/api/map-plan',              desc: 'Mutual Action Plan generator'                                       },
  { method: 'GET',    path: '/api/analyses',              desc: 'Saved AI analyses (GET) / save new (POST)'                          },
  // Signals & market data
  { method: 'GET',    path: '/api/signals',               desc: 'Scored trade signals refreshed nightly — NewsAPI + GPT'             },
  { method: 'GET',    path: '/api/trade-intelligence',    desc: 'FRED macro data (trade balance, freight indices)'                   },
  { method: 'GET',    path: '/api/trade-data/:commodity', desc: 'FRED time-series for a commodity'                                   },
  { method: 'GET',    path: '/api/fx-rates',              desc: 'Live FX rates + 1-day % change'                                     },
  { method: 'GET',    path: '/api/trigger-events',        desc: 'Earnings + supply chain trigger events'                             },
  // Freight tracking
  { method: 'GET',    path: '/api/vessels',               desc: 'Live/simulated vessel positions'                                    },
  { method: 'GET',    path: '/api/flights',               desc: 'Live/simulated cargo flight positions (OpenSky)'                    },
  { method: 'GET',    path: '/api/trucks',                desc: '340 simulated trucks on 85 global highway corridors'                },
  { method: 'GET',    path: '/api/containers/track',      desc: 'Container tracking by number'                                       },
  { method: 'GET',    path: '/api/globe-data',            desc: 'Shipping lanes + port status for globe overlay'                     },
  // Pipeline & performance
  { method: 'GET',    path: '/api/pipeline',              desc: 'Full pipeline grouped by stage'                                     },
  { method: 'GET',    path: '/api/pipeline/count',        desc: 'Active deal count (excl. closed) — status bar badge'                },
  { method: 'POST',   path: '/api/pipeline',              desc: 'Add deal to pipeline'                                               },
  { method: 'PUT',    path: '/api/pipeline/:id',          desc: 'Update stage / notes / deal value'                                  },
  { method: 'DELETE', path: '/api/pipeline/:id',          desc: 'Remove deal'                                                        },
  { method: 'GET',    path: '/api/performance',           desc: 'SDR KPI summary — calls, emails, demos, revenue'                    },
  { method: 'POST',   path: '/api/performance/activity',  desc: 'Log an SDR activity'                                                },
  { method: 'GET',    path: '/api/win-loss',              desc: 'Win/loss records'                                                   },
  { method: 'POST',   path: '/api/win-loss',              desc: 'Log a win or loss outcome'                                          },
  { method: 'GET',    path: '/api/followup-radar',        desc: 'Pipeline contacts overdue for follow-up'                            },
  { method: 'GET',    path: '/api/pipeline-velocity',     desc: 'Average days per pipeline stage'                                    },
  { method: 'GET',    path: '/api/market-map',            desc: 'Prospects grouped by sector for radial market map'                  },
  // Tools
  { method: 'GET',    path: '/api/hs-lookup',             desc: 'HS code tariff lookup'                                              },
  { method: 'POST',   path: '/api/route-optimize',        desc: 'Transit time benchmark comparison across modes'                     },
  { method: 'GET',    path: '/api/settings/health',       desc: 'Backend health + API key configuration status'                      },
];

const SHORTCUTS = [
  { keys: ['Ctrl', '/'],       action: 'Toggle sidebar'     },
  { keys: ['Escape'],          action: 'Close modal/overlay'},
  { keys: ['Ctrl', 'Shift', 'P'], action: 'Open Pipeline'  },
  { keys: ['Ctrl', 'Shift', 'B'], action: 'Open Battle Cards'},
  { keys: ['Ctrl', 'Shift', 'L'], action: 'Open Live Call Mode'},
];

function AboutSection({ health, onTestHealth, healthLoading }) {
  const [endpointsOpen, setEndpointsOpen] = useState(false);

  return (
    <>
      <SettingCard title="Application">
        {[
          { key: 'Application',    val: 'Flexport SDR Intelligence Hub' },
          { key: 'Version',        val: 'v2.1.0'                        },
          { key: 'Frontend',       val: 'React 19 + Vite 7'             },
          { key: 'Backend',        val: 'Express 5 + SQLite 3'          },
          { key: 'AI Engine',      val: 'OpenAI GPT-4.1-mini'           },
          { key: 'Data Sources',   val: 'NewsAPI · FRED · AISstream · OpenSky · ExchangeRate · Serper · Terminal49' },
          { key: 'Design System',  val: '#060b18 · #00d4ff · Space Grotesk + JetBrains Mono' },
        ].map(({ key, val }) => (
          <div key={key} className="about-kv-row">
            <span className="about-key">{key}</span>
            <span className="about-val">{val}</span>
          </div>
        ))}
      </SettingCard>

      <SettingCard title="Platform Pages">
        {[
          { page: 'Home',           path: '/',             desc: 'Globe + prospect intelligence + supply chain signals + today\'s playbook' },
          { page: 'Ocean Freight',  path: '/vessels',      desc: 'Live vessel tracking globe with AISstream, port congestion overlays' },
          { page: 'Air Freight',    path: '/flights',      desc: 'Live cargo flight positions via OpenSky OAuth, route arcs' },
          { page: 'Land Freight',   path: '/land',         desc: '340 simulated trucks on 85 global highway corridors' },
          { page: 'Trade Data',     path: '/trade',        desc: 'Bloomberg-style terminal — FRED macro data, FX rates, trigger events' },
          { page: 'Market Map',     path: '/market',       desc: '250-prospect radial node graph across 15 sectors — TAM, freight avg, live ICP signals' },
          { page: 'Account 360',    path: '/account/:id',  desc: 'Full prospect profile — supply chain diagram, AI analysis, MAP, objection handler' },
          { page: 'Performance',    path: '/performance',  desc: 'SDR KPIs, activity heatmap, quota ring, pipeline funnel, win/loss chart' },
          { page: 'Research',       path: '/research',     desc: 'AI company intelligence briefs — trade profile, signals, why-now' },
        ].map(({ page, path, desc }) => (
          <div key={page} className="setting-row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div className="setting-label" style={{ fontSize: 12 }}>
                {page} <span style={{ color: '#334155', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{path}</span>
              </div>
              <div className="setting-desc">{desc}</div>
            </div>
          </div>
        ))}
      </SettingCard>

      <SettingCard title="Server Status">
        <div className="health-card">
          <div className="health-card-row">
            <span className="health-card-label">API Server</span>
            <div className="health-status">
              {health ? (
                <>
                  <span className={`health-dot ${health.status === 'ok' ? 'ok' : 'error'}`} />
                  <span className="health-label">{health.status === 'ok' ? `Online · v${health.version}` : 'Unreachable'}</span>
                </>
              ) : <span className="health-label muted">Not checked</span>}
            </div>
          </div>
          {health && Object.entries(health.env || {}).map(([k, v]) => (
            <div key={k} className="health-card-row">
              <span className="health-card-label">{k}</span>
              <span className={`env-badge${v ? ' ok' : ' missing'}`}>{v ? 'Configured' : 'Not set'}</span>
            </div>
          ))}
          <button type="button" className="btn-accent-sm" onClick={onTestHealth} disabled={healthLoading}>
            {healthLoading ? 'Checking...' : <><RiPlugLine size={12} /> Check Now</>}
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Keyboard Shortcuts">
        <table className="shortcut-table">
          <tbody>
            {SHORTCUTS.map(({ keys, action }) => (
              <tr key={action}>
                <td className="shortcut-keys">
                  {keys.map((k, i) => (
                    <span key={i}><kbd className="shortcut-key">{k}</kbd>{i < keys.length - 1 && ' + '}</span>
                  ))}
                </td>
                <td className="shortcut-action">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingCard>

      <SettingCard>
        <button
          type="button"
          className="endpoints-toggle"
          onClick={() => setEndpointsOpen(o => !o)}
        >
          <RiTerminalLine size={13} />
          API Endpoints Reference
          <span className="endpoints-chevron">{endpointsOpen ? '▲' : '▼'}</span>
        </button>
        {endpointsOpen && (
          <div className="endpoint-list">
            {API_ROUTES.map(({ method, path, desc }) => (
              <div key={path + method} className="endpoint-row">
                <span className={`endpoint-method method-${method.toLowerCase()}`}>{method}</span>
                <span className="endpoint-path">{path}</span>
                <span className="endpoint-desc">{desc}</span>
              </div>
            ))}
          </div>
        )}
      </SettingCard>

      <SettingCard title="Links">
        {[
          { icon: RiGithubLine,       label: 'GitHub Repository',  href: 'https://github.com/AllStreets/Flexport-sales-dashboard' },
          { icon: RiBug2Line,         label: 'Report a Bug',       href: 'https://github.com/AllStreets/Flexport-sales-dashboard/issues' },
          { icon: RiExternalLinkLine, label: 'FRED API Docs',      href: 'https://fred.stlouisfed.org/docs/api/fred/' },
          { icon: RiExternalLinkLine, label: 'NewsAPI Docs',       href: 'https://newsapi.org/docs' },
          { icon: RiExternalLinkLine, label: 'ExchangeRate API',   href: 'https://www.exchangerate-api.com/docs' },
        ].map(({ icon: Icon, label, href }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="about-link">
            <Icon size={13} />
            {label}
            <RiExternalLinkLine size={11} style={{ marginLeft: 'auto', opacity: 0.4 }} />
          </a>
        ))}
      </SettingCard>
    </>
  );
}

function LiveCallSection() {
  const [autostart, setAutostart] = useSetting('sdr_mic_autostart', false);
  const [frequency, setFrequency] = useSetting('sdr_mic_frequency', 30);
  const [saved,     setSaved]     = useState(false);
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <>
      <SettingCard title="Microphone AI Listener">
        <SettingRow
          label="Auto-start mic on call open"
          description="Immediately begin AI listening when a Live Call modal opens"
          icon={RiMicLine}
        >
          <SettingToggle value={autostart} onChange={(v) => { setAutostart(v); flash(); }} />
        </SettingRow>
        <SettingRow
          label="AI prediction frequency"
          description="How often the AI generates a suggested response based on transcript"
          icon={RiBrainLine}
        >
          <select
            className="setting-input setting-select"
            value={frequency}
            onChange={e => { setFrequency(Number(e.target.value)); flash(); }}
          >
            <option value={15}>Every 15 seconds</option>
            <option value={30}>Every 30 seconds (default)</option>
            <option value={60}>Every 60 seconds</option>
            <option value={120}>Every 2 minutes</option>
          </select>
        </SettingRow>
      </SettingCard>

      <SettingCard title="How It Works">
        <div className="setting-desc" style={{ lineHeight: 1.7 }}>
          When the mic listener is active during a live call, it transcribes your conversation using the
          browser's Web Speech API and periodically sends the transcript to the AI. The AI returns a
          suggested next response, predicted objection, and recommended tone — displayed as a card below
          the objection handler. No audio is stored or transmitted to external services.
        </div>
      </SettingCard>

      <SavedFlash show={saved} />
    </>
  );
}

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'profile',      label: 'Profile',           Icon: RiUserSettingsLine, subtitle: 'Your SDR identity and contact info'           },
  { id: 'quota',        label: 'Quota Targets',     Icon: RiTrophyLine,       subtitle: 'Weekly activity and revenue goals'             },
  { id: 'notifications',label: 'Notifications',     Icon: RiBellLine,         subtitle: 'Alert and digest preferences'                  },
  { id: 'livecall',     label: 'Live Call',         Icon: RiMicLine,          subtitle: 'Mic AI listener and prediction settings'       },
  { id: 'appearance',   label: 'Appearance',        Icon: RiPaletteLine,      subtitle: 'Colors, fonts, and layout density'             },
  { id: 'integrations', label: 'AI & Integrations', Icon: RiCpuLine,          subtitle: 'API keys and backend connectivity'             },
  { id: 'data',         label: 'Data & Privacy',    Icon: RiDatabaseLine,     subtitle: 'Export, retention, and data reset'             },
  { id: 'about',        label: 'About / Help',      Icon: RiInformationLine,  subtitle: 'Version, shortcuts, and documentation'        },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [active, setActive]             = useState('profile');
  const [health, setHealth]             = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const testHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await fetch(`${API}/api/settings/health`).then(r => r.json());
      setHealth(data);
    } catch {
      setHealth({ status: 'error', timestamp: new Date().toISOString(), env: {} });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { testHealth(); }, [testHealth]);

  const section = SECTIONS.find(s => s.id === active);

  const renderSection = () => {
    switch (active) {
      case 'profile':       return <ProfileSection />;
      case 'quota':         return <QuotaSection />;
      case 'notifications': return <NotificationsSection />;
      case 'livecall':      return <LiveCallSection />;
      case 'appearance':    return <AppearanceSection />;
      case 'integrations':  return <IntegrationsSection health={health} onTestHealth={testHealth} healthLoading={healthLoading} />;
      case 'data':          return <DataSection />;
      case 'about':         return <AboutSection health={health} onTestHealth={testHealth} healthLoading={healthLoading} />;
      default:              return null;
    }
  };

  return (
    <div className="settings-page">

      {/* Left nav rail */}
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">
          <RiSettings3Line size={11} style={{ marginRight: 5 }} />
          Settings
        </div>
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`settings-nav-item${active === id ? ' active' : ''}`}
            onClick={() => setActive(id)}
          >
            <span className="settings-nav-icon"><Icon size={16} /></span>
            <span className="settings-nav-label">{label}</span>
          </button>
        ))}
      </aside>

      {/* Right content */}
      <div className="settings-content">
        <div className="settings-section-header">
          <div className="settings-section-icon-wrap" style={{ background: `rgba(0,212,255,0.1)` }}>
            {section && <section.Icon size={18} color="#00d4ff" />}
          </div>
          <div>
            <div className="settings-section-title">{section?.label}</div>
            <div className="settings-section-subtitle">{section?.subtitle}</div>
          </div>
        </div>

        <div className="settings-section-body">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
