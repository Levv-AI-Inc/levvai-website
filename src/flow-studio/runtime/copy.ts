/** 05 §4–§8: every string the runtime and its screens show, exact where the spec gives one. Strings the spec leaves open are marked "mine". */
export const runtimeCopy = {
  // §4 errors
  reasonRequired: 'A reason is required to stop a workflow.',
  runStopped: 'This workflow is stopped. It can’t be resumed.',
  notPaused: 'This workflow isn’t paused.',
  alreadyPaused: 'This workflow is already paused.',
  forbidden: 'Only the workflow owner or an admin can pause, resume or stop it.',
  runEnded: 'This workflow has finished.', // mine: 05 §4 "shows no controls", and a stale page can still post
  // §8 log messages
  started: (source: string, event: string) => `Started from ${source} event “${event}”.`,
  overlapRan: (name: string) => `Two workflows overlap; ran “${name}” by priority.`,
  overlapRanNoPriority: (name: string) => `Two workflows overlap and nothing says which one runs; ran “${name}”, the one listed first.`,
  stepStarted: (step: string) => `${step}: started.`,
  asked: (people: string[], what: string) => `Asked ${people.join(', ')} to ${what}.`,
  askedFor: (person: string, items: string[]) => `Asked ${person} for: ${items.join(', ')}`,
  provided: (provider: string, items: string[]) => `${provider.charAt(0).toUpperCase()}${provider.slice(1)} provided: ${items.join(', ')}`,
  reminder: (person: string) => `Reminder sent to ${person}.`,
  escalated: (sla: number, person: string, relation: string) => `No answer after ${sla}h, so it went to ${person} (${relation}).`,
  approved: (person: string) => `${person} approved.`,
  rejected: (person: string, comment: string) => `${person} rejected: ${comment}`,
  sentBack: (person: string, comment: string) => `${person} sent it back: ${comment}`,
  markedDone: (person: string) => `${person} marked it done.`,
  verified: (person: string) => `${person} verified it.`, // mine
  notVerified: (person: string, comment: string) => `${person} didn’t verify it: ${comment}`, // mine
  resubmitted: (person: string) => `${person} resubmitted it.`, // mine
  systemDone: (system: string, action: string, object: string, ref: string) => `${system}: ${action} ${object} done (ref ${ref}).`,
  retry: (n: number, system: string, error: string) => `Retry ${n} of 3 for ${system}: ${error}`,
  sentBackValue: (system: string, field: string, value: unknown) => `${system} sent back ${field}: ${String(value)}`,
  recordChanged: (labels: string[]) => `Record changed: ${labels.join(', ')}. Levv re-checked who needs to approve.`,
  waitMoved: (label: string, date: string) => `The ${label} changed, so the wait now ends ${date}.`,
  systemPaused: (system: string, error: string) => `${system} failed after 3 retries: ${error}`,
  completed: 'Completed.',
  rejectedAt: (step: string) => `Rejected at “${step}”.`,
  stoppedAt: (step: string) => `Stopped at “${step}”.`,
  startedWorkflow: (target: string) => `Started “${target}”`,
  pausedStep: (message: string) => `Paused: ${message}`,
  autoNotUsed: 'Someone approves on this path, so it doesn’t auto-approve',
  // §3.4 work items
  addCommentToReject: 'Add a comment to reject.',
  addCommentToSendBack: 'Add a comment to send it back.', // mine
  addCommentNotVerified: 'Add a comment to say what’s wrong.', // mine
  resubmitTitle: (title: string) => `Fix and resubmit ${title}`,
  chaserEscalationTitle: (step: string, person: string) => `${step}: no answer from ${person}`,
  fixSystem: (system: string, error: string) => `Fix ${system}: ${error}`,
  notConnected: 'Not connected',
  // Refusals that only a stale page or two people at once can reach (mine)
  alreadyDone: 'This has already been answered.',
  ownRequest: 'You can’t approve your own request.',
  workerCannotDecide: 'You’re the worker on this request, so you can’t approve or review it.',
  fieldsNotEditable: (labels: string[]) => `This can’t be changed here: ${labels.join(', ')}. Ask the workflow owner.`,
  valueDoesNotFit: (label: string) => `That isn’t a value ${label} can have.`,
  keptAfterResubmit: (what: string[]) => `The resubmitted values no longer call for ${what.join(', ')}. A resubmit can’t take anyone off, so they stay on this request.`,
  eventIgnored: (source: string, fields: string[]) => `An event from ${source} tried to change ${fields.join(', ')}. That stays as it is while this request is running.`,
  stuck: 'Nothing is open on this request and nothing is scheduled, so Levv paused it. Nothing was approved.',
  wrongKind: 'That answer doesn’t fit this item.',
  notInItems: 'Hand over everything that was asked for.',
  conflict: 'Someone else changed this at the same moment. Try again.',
  noConflictToChoose: 'There are no proposed changes to choose between.',
  // §5.3 messages
  mail: {
    approvalSubject: (title: string) => `Approval needed: ${title}`,
    approvalBody: (brief: string, link: string) => `${brief}\n\nApprove, reject or send it back in Levv: ${link}`,
    reminderSubject: (step: string, title: string) => `Reminder: ${step} for ${title}`,
    reminderBody: (hours: number, chaseTo: string, sla: number) => `This has been waiting on you for ${hours}h. It goes to ${chaseTo} after ${sla}h.`,
    chaserSubject: (step: string, title: string) => `${step} for ${title} needs you`,
    chaserBody: (person: string, sla: number, link: string) => `${person} hasn’t acted for ${sla}h. You can act on it now: ${link}`,
    decisionSubject: (step: string) => `Decision needed: ${step}`,
    decisionBody: (reason: string, link: string) => `${reason}. Approve to carry on, reject with a comment to stop, or send it back to the requester: ${link}`,
    taskSubject: (what: string) => `To do: ${what}`,
    taskBody: (title: string, id: string, link: string) => `${title} (${id}). Mark it done in Levv when finished: ${link}`,
    rejectedSubject: (title: string) => `Rejected: ${title}`,
    rejectedBody: (title: string, step: string, comment: string) => `${title} was rejected at “${step}”. Reason: ${comment}`,
    systemPausedSubject: (workflow: string, title: string) => `Paused: ${workflow} for ${title}`,
    systemPausedBody: (system: string, error: string, link: string) => `${system} failed after 3 retries: ${error}. Fix it, then resume the workflow: ${link}`,
    stuckSubject: (workflow: string, title: string) => `Nothing is moving: ${workflow} for ${title}`,
    stuckBody: (workflow: string, title: string, link: string) => `“${workflow}” for ${title} has nothing open and nothing scheduled, so Levv paused it. Nothing was approved. See what it is waiting on: ${link}`,
    prereqSubject: (workflow: string) => `Waiting to start: ${workflow}`,
    prereqBody: (workflow: string, title: string, id: string, prerequisite: string) =>
      `“${workflow}” is waiting to start for ${title} (${id}): Levv only starts it once the ${prerequisite}. It has waited 7 days.`,
    flowChangeSubject: (workflow: string) => `Flow change to approve: ${workflow}`,
    flowChangeBody: (author: string, workflow: string, date: string, link: string) =>
      `${author} sent “${workflow}” for approval to go live on ${date}. Review it in Levv: ${link}`,
    notifySubject: (workflow: string, step: string) => `${workflow}: ${step}`,
    notifyBody: (step: string, title: string, id: string, link: string) => `${step}: ${title} (${id}). ${link}`,
    withdrawnSubject: (step: string, title: string) => `No longer needed: ${step} for ${title}`, // mine
    withdrawnBody: (title: string) => `${title} changed, so this approval is no longer needed. You don’t have to do anything.`, // mine
    proposalLostSubject: (field: string, title: string) => `Your proposed change to ${field} wasn’t used: ${title}`, // mine
    proposalLostBody: (v: string, by: string) => `Levv is using ${v} from ${by}. Approval links for your version no longer work.`, // mine
    collectSubject: (step: string) => `To do: ${step}`, // mine: the Collect request has no row in §5.3
    collectBody: (items: string[], title: string, id: string, link: string) => `${items.join(', ')} for ${title} (${id}). Hand them over in Levv: ${link}`, // mine
    fyiSubject: (workflow: string, step: string) => `${workflow}: ${step}`,
  },
  // Mock adapters (00 §4.2), so a real run never reads as if a real system answered. Mine.
  simulated: {
    system: (system: string) => `Simulated: nothing was sent to ${system}. This build has no live connection to it.`,
    verifier: (checker: string) => `Simulated: ${checker} checked nothing. This build has no live connection to it.`,
    check: (check: string) => `Simulated: ${check} worked this out from the record, not from a live service.`,
    banner: 'Some results on this run are simulated. This build has no live connections, so System, verification and Digital Worker steps didn’t call a real service, and messages are queued rather than sent.',
    badge: 'Simulated',
  },
  // §6 screens
  screen: {
    runsTitle: 'Running workflows',
    filterStatus: 'Status',
    filterWorkflow: 'Workflow',
    filterRecord: 'Record',
    allStatuses: 'All statuses',
    allWorkflows: 'All workflows',
    statusSummaryDefault: 'Running, Paused',
    columns: ['Record', 'Workflow', 'Status', 'Waiting on', 'Started', 'Last change'] as const,
    runsEmpty: 'No workflows are running. They start when a record’s event happens, for example a work order being submitted.',
    runsNoAccess: 'You don’t have access to running workflows.', // mine
    loading: 'Loading…', // mine
    loadFailed: 'This page couldn’t load. Reload the page to try again.', // mine, as Flow Studio's
    writeFailed: 'Couldn’t save that change. Check your connection and try again.', // 04 §14.1
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    pauseTitle: 'Pause this workflow?',
    pauseText: 'Nothing new starts and reminders stop until you resume it. People can still answer what they’ve already been asked.',
    pauseReason: 'Reason (optional)',
    pauseConfirm: 'Pause workflow',
    stopTitle: 'Stop this workflow?',
    stopText: 'Steps that haven’t started will never start. This can’t be undone.',
    stopReason: 'Reason',
    stopConfirm: 'Stop workflow',
    cancel: 'Cancel',
    pausedBanner: (name: string, date: string, reason: string) => `Paused by ${name} on ${date} UTC${reason ? `: ${reason}` : ''}. Nothing new starts and reminders are on hold.`,
    pausedBySystem: (system: string) => `Paused by Levv: ${system} failed after 3 retries. Fix it, then resume.`,
    stoppedBanner: (name: string, date: string, reason: string) => `Stopped by ${name} on ${date}: ${reason}. Steps that hadn’t started will never start.`,
    sub: (workflow: string, version: number, date: string) => `${workflow} · v${version} · started ${date} UTC`,
    stepsHeading: 'Steps',
    historyHeading: 'History',
    recordHeading: 'Record',
    idsHeading: 'Brought back from other systems',
    yes: 'Yes',
    no: 'No',
    // Fields the catalog has no label for. "the worker’s time zone" is 02 §14's phrase; the other two are mine.
    recordLabels: { worker_tz: 'Worker’s time zone', requester: 'Requester', sponsor_delegate: 'Sponsor’s delegate' } as Record<string, string>,
    notStarted: 'Not started',
    inProgress: 'In progress',
    waitingOn: (people: string) => `Waiting on ${people}`,
    done: 'Done',
    skipped: 'Skipped',
    failed: 'Failed',
    cancelled: 'Cancelled',
    someoneEligible: 'someone eligible', // mine: a paused item has no person to name
    timers: (remind: string, escalate: string) => `Reminder ${remind} UTC · Escalates ${escalate} UTC`,
    systemRef: (ref: string) => `Ref ${ref}`,
    log: {
      paused: (by: string, date: string, reason: string) => `Paused by ${by} on ${date} UTC${reason ? `: ${reason}` : ''}`,
      resumed: (by: string, date: string) => `Resumed by ${by} on ${date} UTC`,
      stopped: (by: string, date: string, reason: string) => `Stopped by ${by} on ${date} UTC: ${reason}`,
      other: (m: string, date: string) => `${m} ${date} UTC`,
    },
    conflictChoose: (v: string) => `Use ${v}`,
    usingProposal: (v: string, by: string, other: string) => `Using ${v} from ${by}. ${other} has been told, and approval links for the other version no longer work.`,
    conflictText: (field: string, a: { v: string; by: string }, b: { v: string; by: string }) =>
      `Two proposed changes to the ${field.toLowerCase()}: ${a.v} from ${a.by} and ${b.v} from ${b.by}. Nothing is overwritten; approvals wait until one version is chosen.`,
  },
  // §7 inbox
  inbox: {
    title: 'Inbox',
    approvals: 'Approvals',
    tasks: 'Tasks',
    flowChanges: 'Flow changes to approve',
    empty: 'Nothing waiting for you.',
    approve: 'Approve',
    reject: 'Reject',
    sendBack: 'Send back',
    comment: 'Comment',
    rejectTitle: (title: string) => `Reject ${title}?`,
    sendBackTitle: (requester: string) => `Send it back to ${requester}?`,
    cancel: 'Cancel',
    markDone: 'Mark done',
    handOver: 'Hand over',
    verified: 'Verified',
    notVerified: 'Not verified',
    notVerifiedTitle: 'Not verified?', // mine
    save: 'Save',
    resubmit: 'Resubmit',
    due: (date: string) => `Due ${date}`,
    onBehalf: (who: string) => `On behalf of ${who}`,
    stoppedPage: 'This request was stopped. No action is needed.',
    withdrawn: 'This no longer needs you. No action is needed.', // mine: an item the plan let go, on a run that carries on
    ownChange: 'You can’t approve your own change.',
    flowCard: (workflow: string, date: string) => `${workflow} · goes live on ${date}`,
    sentBy: (author: string) => `Sent by ${author}`,
    overlapChoice: (winner: string, other: string) => `If they overlap, “${winner}” runs rather than “${other}”.`, // mine
    answered: 'This has already been answered. No action is needed.', // mine
    notYours: 'This isn’t in your inbox.', // mine
    gone: 'This item doesn’t exist.', // mine
    backToInbox: 'Back to inbox', // mine
    worked: 'Done. It’s moved on.', // mine
    impact: (n: number) => `Applies to new runs. ${n} ${n === 1 ? 'record' : 'records'} in the last 90 days would have started this workflow. Anything already running keeps its current version.`,
  },
  nav: { inbox: 'Inbox', runs: 'Running workflows' },
  switchOffConfirm: (n: number) => (n === 1 ? '1 request is running on this workflow. It’ll finish on it. Switch it off?' : `${n} requests are running on this workflow. They’ll finish on it. Switch it off?`),
  switchOff: 'Switch off',
};
