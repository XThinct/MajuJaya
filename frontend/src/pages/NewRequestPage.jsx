import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingBag, CalendarDays, Clock3, Info } from 'lucide-react';
import { createRequest } from '../api/requests';
import { errorMessage } from '../api/client';
import { PageHeader } from '../components/ui';
const types = [['purchase','Purchase',ShoppingBag,'Equipment & supplies'],['leave','Leave',CalendarDays,'Time away from work'],['overtime','Overtime',Clock3,'Additional work hours']];
function Field({ label, name, ...props }) { return <label>{label}<input name={name} required {...props}/></label>; }
export default function NewRequestPage() {
  const [params] = useSearchParams();
  const [type, setType] = useState(types.some(t => t[0] === params.get('type')) ? params.get('type') : 'purchase');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const { notes, ...details } = data;
    if (type === 'purchase') { details.estimated_cost = Number(details.estimated_cost); details.currency = 'IDR'; }
    if (type === 'overtime') details.hours = Number(details.hours);
    try { const request = await createRequest({ type, details, notes }); navigate(`/requests/${request.id}`); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <><Link className="back-link" to="/requests"><ArrowLeft size={16}/> Back to my requests</Link><PageHeader eyebrow="LET'S GET IT MOVING" title="Create a request" description="Share the details. We'll send it to your assigned approver."/><div className="form-layout"><div><div className="type-picker">{types.map(([value,label,Icon,description]) => <button type="button" aria-pressed={type === value} key={value} className={type === value ? 'selected' : ''} onClick={() => { setType(value); setError(''); }}><Icon size={23}/><strong>{label}</strong><small>{description}</small></button>)}</div><form key={type} className="panel request-form" onSubmit={submit}><h2>Request details</h2><p className="muted">A little context helps your approver make a decision.</p>{error && <div className="error-banner" role="alert">{error}</div>}{type === 'purchase' && <><Field label="What do you need?" name="item_description" placeholder="e.g. Safety gloves, 50 pairs" maxLength={2000}/><div className="form-grid"><Field label="Estimated cost (IDR)" type="number" name="estimated_cost" min="1" max="10000000000000" step="0.01" placeholder="0"/><Field label="Vendor" name="vendor" placeholder="Company or supplier" maxLength={2000}/></div><label>Urgency<select name="urgency" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></>}{type === 'leave' && <><label>Leave type<select name="leave_type"><option value="annual">Annual leave</option><option value="sick">Sick leave</option><option value="personal">Personal leave</option></select></label><div className="form-grid"><Field label="Start date" name="start_date" type="date"/><Field label="End date" name="end_date" type="date"/></div><Field label="Reason for leave" name="reason" placeholder="Tell your approver a little more" maxLength={2000}/></>}{type === 'overtime' && <><div className="form-grid"><Field label="Overtime date" name="date" type="date"/><Field label="Hours (up to 12)" name="hours" type="number" min="0.5" max="12" step="0.5"/></div><Field label="Reason for overtime" name="reason" placeholder="What will you be working on?" maxLength={2000}/></>}<label>Additional notes <span className="optional">(optional)</span><textarea name="notes" rows={4} maxLength={4000} placeholder="Anything else your approver should know?"/></label><div className="form-actions"><Link className="button secondary" to="/requests">Cancel</Link><button className="button primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit request'}<ArrowRight size={16}/></button></div></form></div><aside className="help-panel"><Info size={22}/><h3>What happens next?</h3><ol><li>Your request goes to your assigned manager.</li><li>They review the details and approve or reject it.</li><li>You can track the decision and history here.</li></ol><p>You can cancel a request while it is still pending.</p></aside></div></>;
}
