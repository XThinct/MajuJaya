import { useSearchParams, Link } from 'react-router-dom';
import { Search, Plus, SlidersHorizontal } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { listRequests } from '../api/requests';
import { PageHeader, RequestTable, LoadState } from '../components/ui';
export default function RequestsPage({ inbox = false }) {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '', type = params.get('type') || '', search = params.get('search') || '';
  const scope = inbox ? 'inbox' : 'mine';
  const state = useLoad(() => listRequests({ scope, status: status || undefined, type: type || undefined, search: search || undefined }), [scope, status, type, search]);
  function change(key, value) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); }
  return <><PageHeader eyebrow={inbox ? 'REVIEW & DECIDE' : 'SUBMIT & TRACK'} title={inbox ? 'Approval inbox' : 'My requests'} description={inbox ? 'Requests assigned to you. Give your team a clear next step.' : 'Everything you have requested, with every update in one place.'} action={!inbox && <Link className="button primary" to="/requests/new"><Plus size={17}/> New request</Link>}/><section className="panel"><div className="tabs" role="group" aria-label="Filter by status">{[['','All requests'],['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['cancelled','Cancelled']].map(([value,label]) => <button aria-pressed={status === value} className={status === value ? 'active' : ''} onClick={() => change('status',value)} key={value}>{label}</button>)}</div><div className="filter-row"><label className="search-field"><Search size={17}/><input aria-label="Search requests" placeholder="Search requests or people..." value={search} onChange={e => change('search',e.target.value)}/></label><label className="type-filter"><SlidersHorizontal size={16}/><select aria-label="Filter by type" value={type} onChange={e => change('type',e.target.value)}><option value="">All request types</option><option value="purchase">Purchase</option><option value="leave">Leave</option><option value="overtime">Overtime</option></select></label></div><LoadState {...state}/>{state.data && <><RequestTable requests={state.data}/><div className="table-footer">{state.data.length} request{state.data.length !== 1 ? 's' : ''}<span>Times shown in Jakarta time (WIB)</span></div></>}</section></>;
}
