import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X, AlertTriangle, Clock3, Forward } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { getRequest, decideRequest, cancelRequest } from '../api/requests';
import { errorMessage } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { LoadState, Status, date, title, money, Avatar } from '../components/ui';
const labels = { item_description: 'Item description', estimated_cost: 'Estimated cost', currency: 'Currency', vendor: 'Vendor', urgency: 'Urgency', leave_type: 'Leave type', start_date: 'Start date', end_date: 'End date', reason: 'Reason', date: 'Date', hours: 'Hours' };
const confirmations = {
  approved: { title: 'Approve this request?', description: 'This will complete the request and record your approval.', confirmLabel: 'Yes, approve', icon: Check },
  rejected: { title: 'Reject this request?', description: 'This will complete the request as rejected. Your reason will be saved with the decision.', confirmLabel: 'Yes, reject', icon: X, danger: true },
  forward_to_finance: { title: 'Approve and send to Finance?', description: 'Your approval will be recorded and the purchase sent to the Finance Manager. The request will stay pending.', confirmLabel: 'Send to Finance', icon: Forward },
  forward_to_director: { title: 'Approve and send to Director?', description: 'Your approval will be recorded and the purchase sent to the director for a final decision. The request will stay pending.', confirmLabel: 'Send to Director', icon: Forward },
  cancel: { title: 'Cancel this request?', description: 'This will cancel your pending request and save the cancellation in its history.', confirmLabel: 'Yes, cancel request', icon: X, danger: true },
};
export default function RequestDetailPage() {
  const { id } = useParams();
  const state = useLoad(() => getRequest(id), [id]);
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(null);
  const noteRef = useRef(null);
  function requestAction(decision) {
    setError('');
    if (decision === 'rejected' && !note.trim()) { setError('Give a reason for rejecting this request.'); noteRef.current?.focus(); return; }
    setConfirmation(decision);
  }
  async function action() {
    if (busy || !confirmation) return;
    const decision = confirmation;
    setError('');
    if (decision === 'rejected' && !note.trim()) { setError('Give a reason for rejecting this request.'); return; }
    setBusy(true);
    try { if (decision === 'cancel') await cancelRequest(id); else await decideRequest(id, decision, note); setConfirmation(null); setNote(''); state.reload(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const r = state.data;
  return <><Link className="back-link" to="/requests"><ArrowLeft size={16}/> Back to requests</Link><LoadState {...state}/>{r && <><div className="detail-heading"><div className="eyebrow">{r.type.toUpperCase()} REQUEST <span className="muted">/ {r.id.length > 12 ? r.id.slice(0,12) : r.id}</span></div><Status value={r.status}/><h1>{title(r)}</h1><p>Submitted {date(r.submitted_at, true)} WIB</p>{r.type === 'purchase' && r.status === 'pending' && r.approval_stage !== 'initial' && <p className="approval-progress">{r.approval_stage === 'finance' ? 'Awaiting Finance Manager review' : 'Awaiting director approval'}</p>}</div>{r.issues?.length > 0 && <div className="warning-banner"><AlertTriangle size={20}/><div><strong>Historical record: review needed</strong><ul>{r.issues.map(issue => <li key={issue}>{issue}</li>)}</ul><p>Original records are retained. Invalid details cannot be approved; reject with a reason and ask for a corrected submission.</p></div></div>}<div className="detail-layout"><div><section className="panel detail-panel"><h2>Request details</h2><dl className="details-grid">{Object.entries(r.details).map(([key,value]) => <div key={key}><dt>{labels[key] || key}</dt><dd>{key === 'estimated_cost' ? money(value) : key.includes('date') ? date(value) : value ?? 'Not provided'}</dd></div>)}</dl>{r.notes && <div className="notes"><h3>Additional notes</h3><p>{r.notes}</p></div>}{r.decision_note && <div className="notes"><h3>Decision note</h3><p>{r.decision_note}</p></div>}</section><section className="panel detail-panel"><h2>Activity timeline</h2><div className="timeline">{r.activities.map(a => <div className="timeline-item" key={a.id}><span className="timeline-dot"><Clock3 size={14}/></span><div><strong className="capitalize">{a.action.replaceAll('_', ' ')}</strong><p>{a.actor?.name || 'System'} <span>· {date(a.created_at, true)} WIB</span></p>{a.note && <div className="timeline-note">{a.note}</div>}</div></div>)}</div></section></div><aside><section className="panel detail-panel"><h2>People</h2><div className="detail-person"><small>REQUESTED BY</small><div className="person"><Avatar name={r.submitter.name}/><div><strong>{r.submitter.name}</strong><small>{r.submitter.role}</small></div></div></div><div className="detail-person"><small>{['approved', 'rejected'].includes(r.status) ? 'RECORDED DECISION BY' : 'ASSIGNED APPROVER'}</small>{r.approver ? <div className="person"><Avatar name={r.approver.name}/><div><strong>{r.approver.name}</strong><small>{r.approver.role}</small></div></div> : <p>Not assigned. Contact HR.</p>}</div></section>{(r.can_decide || r.can_cancel) && <section className="panel detail-panel decision-panel"><h2>{r.can_decide ? 'Your decision' : 'Manage request'}</h2>{error && !confirmation && <div role="alert" className="error-banner">{error}</div>}{r.can_decide && <><p className="muted">Review the request before making a decision. Rejections require a reason.</p><label>Decision note<textarea ref={noteRef} disabled={busy} value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={4} placeholder="Add context for the requester..."/></label><button className="button primary" disabled={busy} onClick={() => requestAction('approved')}><Check size={17}/> Approve request</button>{r.can_forward_to_finance && <><button className="button secondary" disabled={busy} onClick={() => requestAction('forward_to_finance')}><Forward size={17}/> Approve &amp; send to Finance</button><p className="forward-help">Use when Finance needs to review this purchase. It stays pending until Finance or the director makes the final decision.</p></>}{r.can_forward_to_director && <><button className="button secondary" disabled={busy} onClick={() => requestAction('forward_to_director')}><Forward size={17}/> Approve &amp; send to Director</button><p className="forward-help">Use when director approval is required. You can also approve this purchase as the final checkpoint.</p></>}<button className="button danger-outline" disabled={busy} onClick={() => requestAction('rejected')}><X size={17}/> Reject request</button></>}{r.can_cancel && <><p className="muted">No longer needed? You can cancel before a decision is made.</p><button className="button danger-outline" disabled={busy} onClick={() => requestAction('cancel')}>Cancel request</button></>}</section>}</aside></div><ConfirmDialog open={Boolean(confirmation)} {...(confirmations[confirmation] || {})} busy={busy} error={error} onClose={() => { if (!busy) { setConfirmation(null); setError(''); } }} onConfirm={action}>
        <div className="confirmation-summary"><strong>{title(r)}</strong><span>Requested by {r.submitter.name}</span></div>
        {confirmation !== 'cancel' && note.trim() && <div className="confirmation-note"><strong>{confirmation === 'rejected' ? 'Reason for rejection' : 'Decision note'}</strong><p>{note}</p></div>}
      </ConfirmDialog></>}</>;
}
