import { Link } from 'react-router-dom';
import { History, ArrowUpRight } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { listActivity } from '../api/employees';
import { PageHeader, LoadState, date, Empty } from '../components/ui';
export default function ActivityPage() {
  const state = useLoad(listActivity, []);
  return <><PageHeader eyebrow="A RECORD YOU CAN FOLLOW" title="Activity history" description="Submissions, decisions, and cancellations for requests you can access. Latest 200 events."/><section className="panel"><LoadState {...state}/>{state.data && (state.data.length ? <div className="activity-list">{state.data.map(a => <div className="activity-row" key={a.id}><span className={`activity-icon ${a.action}`}><History size={19}/></span><div><strong><span className="capitalize">{a.action}</span> <Link to={`/requests/${a.request_id}`}>{a.request_id.length > 15 ? a.request_id.slice(0,15) + '...' : a.request_id}</Link></strong><p>{a.actor?.name || 'Historical data import'}{a.note && ` · ${a.note}`}</p></div><time>{date(a.created_at,true)} WIB</time><Link aria-label="View request" className="icon-link" to={`/requests/${a.request_id}`}><ArrowUpRight size={17}/></Link></div>)}</div> : <Empty title="No activity yet"/>)}</section></>;
}
