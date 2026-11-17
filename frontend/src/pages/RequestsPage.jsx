import { useSearchParams, Link } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { listRequests } from '../api/requests';
import { PageHeader, RequestTable, LoadState } from '../components/ui';
export default function RequestsPage({ inbox = false, history = false }) {
  const [params, setParams] = useSearchParams();
  const completedStatuses = ['approved', 'rejected', 'cancelled'];
  const selectedStatus = params.get('status') || '';
  const status = history && !completedStatuses.includes(selectedStatus) ? '' : selectedStatus, type = params.get('type') || '', search = params.get('search') || '';
  const scope = inbox ? 'inbox' : history ? 'all' : 'mine';
  const state = useLoad(() => listRequests({ scope, status: status || undefined, type: type || undefined, search: search || undefined }), [scope, status, type, search]);
  const requests = history ? state.data?.filter(request => completedStatuses.includes(request.status)) : state.data;
  const statusTabs = [['', 'All requests'], ...(!history ? [['pending', 'Pending']] : []), ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']];
  function change(key, value) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); }
  return <div className="table-page"><PageHeader title={inbox ? 'Approval inbox' : history ? 'Activity history' : 'My requests'} description={inbox ? 'Requests assigned to you. Give your team a clear next step.' : history ? 'Approved, rejected, and cancelled requests shared with your department and role.' : 'Everything you have requested, with every update in one place.'} action={!inbox && !history && <Link className="button primary" to="/requests/new"><Plus size={17}/> New request</Link>}/><section className="panel table-panel"><div className="tabs" role="group" aria-label="Filter by status">{statusTabs.map(([value,label]) => <button aria-pressed={status === value} className={status === value ? 'active' : ''} onClick={() => change('status',value)} key={value}>{label}</button>)}</div><div className="filter-row"><label className="search-field"><Search size={17}/><input aria-label="Search requests" placeholder="Search requests or people..." value={search} onChange={e => change('search',e.target.value)}/></label><label className="type-filter"><SlidersHorizontal size={16}/><select aria-label="Filter by type" value={type} onChange={e => change('type',e.target.value)}><option value="">All request types</option><option value="purchase">Purchase</option><option value="leave">Leave</option><option value="overtime">Overtime</option></select></label></div><LoadState {...state}/>{requests && <><RequestTable requests={requests} showSubmittedTime={history}/><div className="table-footer">{requests.length} request{requests.length !== 1 ? 's' : ''}<span>Times shown in Jakarta time (WIB)</span></div></>}</section></div>;
}
