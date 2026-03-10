// frontend/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  RiGlobalLine, RiLineChartLine, RiBarChartGroupedLine, RiRadarLine, RiPercentLine,
  RiSettings3Line, RiSearchEyeLine,
} from 'react-icons/ri';
import './Sidebar.css';

const NAV = [
  { to: '/',            Icon: RiGlobalLine,          label: 'Home'                },
  { to: '/market',      Icon: RiRadarLine,            label: 'Market Map'          },
  { to: '/tariff',      Icon: RiPercentLine,          label: 'Tariff Calculator'   },
  { to: '/trade',       Icon: RiLineChartLine,        label: 'Trade Intelligence'  },
  { to: '/performance', Icon: RiBarChartGroupedLine,  label: 'SDR Dashboard'       },
  { to: '/research',    Icon: RiSearchEyeLine,        label: 'Research'            },
];

function SidebarLink({ to, Icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
      title={label}
    >
      <span className="sidebar-icon"><Icon size={18} /></span>
      <span className="sidebar-label">{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ collapsed }) {
  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-main-nav">
        {NAV.map(({ to, Icon, label }) => (
          <SidebarLink key={to} to={to} Icon={Icon} label={label} end={to === '/'} />
        ))}
      </div>
      <div className="sidebar-bottom-nav">
        <SidebarLink to="/settings" Icon={RiSettings3Line} label="Settings" />
      </div>
    </nav>
  );
}
