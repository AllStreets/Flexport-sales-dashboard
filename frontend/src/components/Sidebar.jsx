// frontend/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV = [
  { to: '/',            icon: '🌐', label: 'Home'          },
  { to: '/trade',       icon: '📊', label: 'Trade Intel'   },
  { to: '/performance', icon: '📈', label: 'SDR Dashboard' },
  { to: '/market',      icon: '🗺️',  label: 'Market Map'   },
];

export default function Sidebar({ collapsed }) {
  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {NAV.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          title={item.label}
        >
          <span className="sidebar-icon">{item.icon}</span>
          <span className="sidebar-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
