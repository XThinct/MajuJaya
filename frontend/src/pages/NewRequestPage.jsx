import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShoppingBag, CalendarDays, Clock3, Info } from 'lucide-react';
import { createRequest } from '../api/requests';
import { errorMessage } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { PageHeader } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
const types = [['purchase','Purchase',ShoppingBag,'Equipment & supplies'],['leave','Leave',CalendarDays,'Time away from work'],['overtime','Overtime',Clock3,'Additional work hours']];
function Field({ label, name, ...props }) { return <label>{label}<input name={name} required {...props}/></label>; }
export default function NewRequestPage() {
  const { user } = useAuth();
  const managerPurchase = typeValue => typeValue === 'purchase' && /\bManager$/i.test(user.role || '') && user.role !== 'Finance Manager';
  const [params] = useSearchParams();
  const [type, setType] = useState(types.some(t => t[0] === params.get('type')) ? params.get('type') : 'purchase');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const navigate = useNavigate();
  const [pendingRequest, setPendingRequest] = useState(null);
  async function submit(event) {
    event.preventDefault(); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const { notes, ...details } = data;
    if (type === 'purchase') { details.estimated_cost = Number(details.estimated_cost); details.currency = 'IDR'; }
    if (type === 'overtime') details.hours = Number(details.hours);
    setPendingRequest({ type, details, notes });
  }
  async function confirmSubmit() {
    if (busy || !pendingRequest) return;
    setBusy(true); setError('');
    try { const request = await createRequest(pendingRequest); navigate(`/requests/${request.id}`); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <><Link className="back-link" to="/requests?scope=mine"><ArrowLeft size={16}/> Back to my requests</Link><PageHeader eyebrow="LET'S GET IT MOVING" title="Create a request" description="Share the details. We'll send it to your assigned approver."/><div className="form-layout"><div><div className="type-picker">{types.map(([value,label,Icon,description]) => <button type="button" aria-pressed={type === value} key={value} className={type === value ? 'selected' : ''} onClick={() => { setType(value); setError(''); }}><Icon size={23}/><strong>{label}</strong><small>{description}</small></button>)}</div><form key={type} className="panel request-form" onSubmit={submit}><h2>Request details</h2><p className="muted">A little context helps your approver make a decision.</p>{error && !pendingRequest && <div className="error-banner" role="alert">{error}</div>}{type === 'purchase' && <><Field label="What do you need?" name="item_description" placeholder="e.g. Safety gloves, 50 pairs" maxLength={2000}/><div className="form-grid"><Field label="Estimated cost (IDR)" type="number" name="estimated_cost" min="1" max="10000000000000" step="0.01" placeholder="0"/><Field label="Vendor" name="vendor" placeholder="Company or supplier" maxLength={2000}/></div><label>Urgency<select name="urgency" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></>}{type === 'leave' && <><label>Leave type<select name="leave_type"><option value="annual">Annual leave</option><option value="sick">Sick leave</option><option value="personal">Personal leave</option></select></label><div className="form-grid"><Field label="Start date" name="start_date" type="date"/><Field label="End date" name="end_date" type="date"/></div><Field label="Reason for leave" name="reason" placeholder="Tell your approver a little more" maxLength={2000}/></>}{type === 'overtime' && <><div className="form-grid"><Field label="Overtime date" name="date" type="date"/><Field label="Hours (up to 12)" name="hours" type="number" min="0.5" max="12" step="0.5"/></div><Field label="Reason for overtime" name="reason" placeholder="What will you be working on?" maxLength={2000}/></>}<label>Additional notes <span className="optional">(optional)</span><textarea name="notes" rows={4} maxLength={4000} placeholder="Anything else your approver should know?"/></label><div className="form-actions"><Link className="button secondary" to="/requests?scope=mine">Cancel</Link><button className="button primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit request'}<ArrowRight size={16}/></button></div>{managerPurchase(type) && <p className="submission-help">Your purchase request will be sent directly to the Finance Manager for review.</p>}</form></div><aside className="help-panel"><Info size={22}/><h3>What happens next?</h3><ol><li>Your request goes to the appropriate approver.</li><li>They review it, approve or reject it, or forward a purchase for further review.</li><li>You can track the decision and history here.</li></ol><p>You can cancel a request while it is still pending.</p></aside></div><ConfirmDialog open={Boolean(pendingRequest)} title="Submit this request?" description={managerPurchase(pendingRequest?.type) ? 'Your purchase request will be sent to the Finance Manager for review.' : 'Your request will be sent to the appropriate approver for review.'} confirmLabel="Yes, submit request" icon={ArrowRight} busy={busy} error={error} onClose={() => { if (!busy) { setPendingRequest(null); setError(''); } }} onConfirm={confirmSubmit}>
      {pendingRequest && <div className="confirmation-summary"><strong className="capitalize">{pendingRequest.type} request</strong><span>{pendingRequest.details.item_description || pendingRequest.details.reason}</span></div>}
    </ConfirmDialog></>;
}
