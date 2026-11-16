import { AlertCircle, ArrowUpRight, Inbox, LoaderCircle, ShoppingBag, CalendarDays, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
export const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
export const date = (value, time = false) => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Jakarta' }).format(new Date(value)) : '—';
export const title = r => r.type === 'purchase' ? r.details.item_description || 'Purchase details missing' : r.type === 'leave' ? `${r.details.leave_type} leave` : r.details.reason;
export const initials = name => name.split(' ').slice(0, 2).map(s => s[0]).join('');
export const typeIcons = { purchase: ShoppingBag, leave: CalendarDays, overtime: Clock3 };
export function Status({ value }) { return <span className={`status ${value}`}><i/>{value}</span>; }
export function Avatar({ name, small = false }) { return <span className={`avatar ${small ? 'small' : ''}`}>{initials(name)}</span>; }
export function PageHeader({ eyebrow, title: heading, description, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{heading}</h1><p>{description}</p></div>{action}</div>; }
export function LoadState({ loading, error, reload }) {
  if (loading) return <div className="load-state" role="status"><LoaderCircle className="spin" size={22}/> Loading your workspace...</div>;
  if (error) return <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span>{reload && <button className="text-button" onClick={reload}>Try again</button>}</div>;
  return null;
}
export function Empty({ title: heading = 'Nothing here yet', text = 'Requests will appear here as they are submitted.' }) { return <div className="empty"><Inbox size={34}/><h3>{heading}</h3><p>{text}</p></div>; }
export function RequestTable({ requests, compact = false }) {
  if (!requests.length) return <Empty title="No matching requests" text="Try another filter, or create your first request."/>;
  return <div className="table-scroll"><table><thead><tr><th>Request</th><th>Requested by</th><th>Status</th>{!compact && <th>Submitted</th>}<th><span className="sr-only">Open</span></th></tr></thead><tbody>{requests.map(r => {
    const Icon = typeIcons[r.type];
    return <tr key={r.id}><td><div className="request-cell"><span className={`type-icon ${r.type}`}><Icon size={19}/></span><div><Link className="request-title" to={`/requests/${r.id}`}>{title(r)}</Link><div className="meta"><span className="capitalize">{r.type}</span><span>·</span><span>{r.type === 'purchase' ? money(r.details.estimated_cost) : r.type === 'leave' ? `${date(r.details.start_date)} – ${date(r.details.end_date)}` : `${r.details.hours} hours`}</span>{r.issues?.length > 0 && <span className="issue-dot" title="Imported record needs review"><AlertCircle size={13}/> Review</span>}</div></div></div></td><td><div className="person"><Avatar name={r.submitter.name} small/><div><strong>{r.submitter.name}</strong><small>{r.submitter.department?.name || 'Unassigned department'}</small></div></div></td><td><Status value={r.status}/></td>{!compact && <td className="nowrap muted">{date(r.submitted_at)}</td>}<td><Link className="icon-link" to={`/requests/${r.id}`} aria-label={`Open ${title(r)}`}><ArrowUpRight size={18}/></Link></td></tr>;
  })}</tbody></table></div>;
}
