// frontend/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { RiGlobalLine, RiLineChartLine, RiBarChartGroupedLine, RiRadarLine } from 'react-icons/ri';
import './Sidebar.css';

const NAV = [
  { to: '/',            Icon: RiGlobalLine,          label: 'Home'          },
  { to: '/trade',       Icon: RiLineChartLine,        label: 'Trade Intel'   },
  { to: '/performance', Icon: RiBarChartGroupedLine,  label: 'SDR Dashboard' },
  { to: '/market',      Icon: RiRadarLine,            label: 'Market Map'    },
];

export default function Sidebar({ collapsed }) {
  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {NAV.map(({ to, Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          title={label}
        >
          <span className="sidebar-icon"><Icon size={18} /></span>
          <span className="sidebar-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
