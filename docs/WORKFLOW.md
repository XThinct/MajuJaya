# Evolving the approval workflow

The current system has one assigned approver per request and server-enforced transitions from pending to approved, rejected, or cancelled. The schema can retain source data, and new requests resolve their approver from the employee reporting hierarchy with documented fallbacks.

## Configurable rules

Add versioned workflow definitions containing request type, condition predicates, and ordered approval steps. Conditions should use an allowlisted declarative format, never executable JavaScript or SQL supplied by an administrator.

For example, purchase requests with an estimated cost **above** IDR 100,000,000 match a rule containing `department_manager` followed by `plant_director`. Exactly IDR 100,000,000 would remain a single approval under the client's wording. Lower-value requests and leave/overtime match their own rules. Rule priority and default fallbacks must be explicit, with a publish-time check that rules do not produce ambiguous routes.

At submission, resolve a published workflow version, snapshot that version and the matched rule, and create request-step instances. A step records its eligible approver, status, decision, actor, timestamps, and reason. The request becomes approved only when all required steps complete; a rejection ends the workflow. Use the same row locks and transactional activity writes already used by this project. If the manager is also the director, an explicit rule should determine whether the duplicate step is skipped or routed to another authority; never allow self-approval.

## Manager absence and delegation

Add dated delegation records with delegator, delegate, effective start/end, permitted request types, limits, and reason. Resolve an active delegation before assigning a step, validate that the delegate is active and authorized, reject cycles and self-approval, and retain both the intended approver and actual acting delegate in history.

For already-pending steps, HR can explicitly reassign with a reason, preserving the original assignee and recording a new audit event. Publishing a workflow must not silently change requests already in flight. Escalation schedules, reminders, and leave-calendar integration can follow this explicit reassignment model.

## Administrative controls

Provide a rule editor with draft/published versions, preview against example requests, and a history of changes. Authorizing edits should be separate from ordinary HR visibility. Publishing validates unreachable or contradictory rules, missing roles, approval cycles, invalid amount/currency comparisons, and missing default routes. Evaluate amounts as exact decimals in a specified currency. Test threshold boundaries, concurrent decisions, absent managers, expired delegations, and workflow-version retention.
