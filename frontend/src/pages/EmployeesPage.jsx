import { useState } from 'react';
import { Search } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { listEmployees } from '../api/employees';
import { PageHeader, LoadState, Avatar, Empty } from '../components/ui';
export default function EmployeesPage() {
  const state = useLoad(listEmployees, []);
  const [search,setSearch] = useState('');
  const employees = state.data?.filter(e => `${e.name} ${e.role} ${e.department?.name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="table-page"><PageHeader eyebrow="THE PEOPLE BEHIND THE WORK" title="People" description="Employee records, departments, and roles."/><section className="panel table-panel"><div className="filter-row"><label className="search-field"><Search size={17}/><input aria-label="Search employees" placeholder="Search people or departments..." value={search} onChange={e => setSearch(e.target.value)}/></label><span className="muted">{employees?.length || 0} people</span></div><LoadState {...state}/>{employees && (employees.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Employees table"><table><thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Status</th></tr></thead><tbody>{employees.map(e => <tr key={e.id}><td><div className="person"><Avatar name={e.name}/><div><strong>{e.name}</strong><small>{e.email}</small></div></div></td><td>{e.department?.name || 'Unknown department'}</td><td>{e.role}</td><td><span className={`status ${e.status === 'active' ? 'approved' : 'cancelled'}`}>{e.status}</span></td></tr>)}</tbody></table></div> : <Empty title="No matching employees"/>)}</section></div>;
}
