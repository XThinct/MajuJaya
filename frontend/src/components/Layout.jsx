import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Files, Inbox, History, LogOut, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './ui';

export default function Layout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const tablePage = ['/requests', '/approvals', '/activity'].includes(pathname.toLowerCase().replace(/\/$/, ''));
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('majujaya-sidebar-collapsed');
      return saved === null ? mobile : saved === 'true';
    } catch { return mobile; }
  });
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)');
    const update = event => setMobile(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('majujaya-sidebar-collapsed', String(collapsed)); }
    catch { /* The toggle also works when browser storage is unavailable. */ }
  }, [collapsed]);
  const links = [
    ['/', 'Overview', LayoutDashboard],
    ...(user.role !== 'Plant Director' ? [['/requests', 'My requests', Files]] : []),
    ...(user.canApproveRequests ? [['/approvals', 'Approval inbox', Inbox]] : []),
    ['/activity', 'Activity history', History],
  ];
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  function closeSidebar() {
    setCollapsed(true);
    toggleRef.current?.focus({ preventScroll: true });
  }
  function toggleSidebar() {
    if (collapsed) setCollapsed(false);
    else closeSidebar();
  }
  useEffect(() => {
    if (!mobile || collapsed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [
      ...(sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])') || []),
      toggleRef.current,
    ].filter(element => element && element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus({ preventScroll: true }));
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) return;
      if (!elements.includes(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobile, collapsed]);

  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${tablePage ? ' table-shell' : ''}`}>
    <aside ref={sidebarRef} id="app-sidebar" className="sidebar" aria-label="Main menu" inert={collapsed}>
      <div className="sidebar-heading">
        <Link to="/" className="brand" aria-label="Maju Jaya overview" onClick={() => { if (mobile) closeSidebar(); }}>
          <span className="brand-symbol"><CheckCheck size={24}/></span>
          <span className="brand-name">Maju Jaya<small>APPROVAL WORKSPACE</small></span>
        </Link>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {links.map(([to, label, Icon]) => <NavLink key={to} to={to} onClick={() => { if (mobile) closeSidebar(); }} end={to === '/' || to === '/requests'} aria-label={label} title={collapsed ? label : undefined}>
          <Icon size={19} aria-hidden="true"/><span className="nav-label">{label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="profile" onClick={signOut} title="Sign out" aria-label="Sign out">
          <Avatar name={user.name}/><span className="profile-details"><strong>{user.name}</strong><small>{user.role}</small></span><LogOut size={17}/>
        </button>
      </div>
    </aside>
    {mobile && !collapsed && <button type="button" className="sidebar-backdrop" tabIndex={-1} aria-label="Close sidebar" onClick={closeSidebar}/>}
    <div className="sidebar-toggle-position">
      <button ref={toggleRef} type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} aria-controls="app-sidebar">
        <ToggleIcon size={20} aria-hidden="true"/>
      </button>
    </div>
    <div className={`workspace${tablePage ? ' table-workspace' : ''}`} inert={mobile && !collapsed}>
      <header className="topbar">
        <div className="company-label">PT Maju Jaya Manufaktur <span>Internal workspace</span></div>
        <div className="topbar-actions"><button className="mobile-signout icon-link" onClick={signOut} aria-label="Sign out"><LogOut size={17}/></button></div>
      </header>
      <main className={tablePage ? 'table-main' : undefined}><Outlet/></main>
    </div>
  </div>;
}
