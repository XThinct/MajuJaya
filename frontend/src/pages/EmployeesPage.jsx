import { useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { listEmployees } from '../api/employees';
import { PageHeader, LoadState, Avatar, Empty } from '../components/ui';
export default function EmployeesPage() {
  const state = useLoad(listEmployees, []);
  const [search,setSearch] = useState('');
  const employees = state.data?.filter(e => `${e.name} ${e.role} ${e.department?.name}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="THE PEOPLE BEHIND THE WORK" title="People" description="Employee records, reporting lines, and imported data that needs attention."/><section className="panel"><div className="filter-row"><label className="search-field"><Search size={17}/><input aria-label="Search employees" placeholder="Search people or departments..." value={search} onChange={e => setSearch(e.target.value)}/></label><span className="muted">{employees?.length || 0} people</span></div><LoadState {...state}/>{employees && (employees.length ? <div className="table-scroll"><table><thead><tr><th>Employee</th><th>Department</th><th>Reports to</th><th>Status</th><th>Data quality</th></tr></thead><tbody>{employees.map(e => <tr key={e.id}><td><div className="person"><Avatar name={e.name}/><div><strong>{e.name}</strong><small>{e.role}</small><small>{e.email}</small></div></div></td><td>{e.department?.name || 'Unknown department'}</td><td>{e.manager?.name || '—'}</td><td><span className={`status ${e.status === 'active' ? 'approved' : 'cancelled'}`}>{e.status}</span></td><td>{e.issues.length ? <div className="quality-issue"><AlertCircle size={15}/><span>{e.issues.join('; ')}</span></div> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div> : <Empty title="No matching employees"/>)}</section></>;
}
