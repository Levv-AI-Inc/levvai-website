/**
 * Every user-visible string the engine produces (03-engine). Curly quotes and apostrophes are part of the text.
 * Components and tests share these, so a string is only ever written here.
 */

/** 03 §0: labels from the seed are stored with a straight apostrophe and displayed with a curly one. */
export const curl = (text: string): string => text.replace(/'/g, '’');

const plural = (n: number, one: string, many: string = `${one}s`): string => (n === 1 ? one : many);

export const copy = {
  /* §1.3, §1.4 */
  unknownField: 'Unknown field',
  pickAValue: '(pick a value)',
  always: 'Always',
  everywhere: 'Everywhere',
  moreRoles: (first: string, more: number) => `${first} + ${more} more`,

  /* §1.6 */
  endDateInDays: (days: number) => `End date in ${days} days`,
  documentExpiringInDays: (days: number) => `Document expiring in ${days} days`,

  /* §1.7, §6.6 */
  theWorker: 'the worker',
  theSponsor: 'the sponsor',
  sowOwnerPlaceholder: 'SOW owner',
  delegateSuffix: (delegate: string) => `, or their delegate ${delegate}`,

  /* §1.8 */
  waitsFor: (amount: number | undefined, unit: string) => `Waits ${amount} ${unit}`,
  waitUntilAt: (at: string) => `Until ${at.replace('T', ' at ')}`,
  pickDateTime: 'Pick a date and time',
  waitOffset: (amount: number, unit: string, dir: string) => `${amount} ${unit} ${dir} `,
  waitsUntil: 'Waits until ',
  until: 'Until ',
  inWorkerZone: ' in the worker’s time zone',
  companyTime: ' company time',

  /* §1.9 */
  DISP: { remove: 'Remove access', return: 'Return equipment', retain: 'Retain obligation' },

  /* §1.10 */
  sysCheckShort: (system: string) => `Check ${system} matches the ledger`,
  sysWaitShort: (object: string, system: string) => `Wait for ${object} in ${system}`,
  sysActionShort: (action: string, object: string, system: string) => `${action} ${object} in ${system}`,
  sysNotConnected: (system: string, who: string) =>
    `${system} isn’t connected yet, so this step pauses and ${who} is asked to do it by hand`,
  theOwner: 'the owner',
  sysMatched: (match: string, fields: number) => `, matched on ${match}, ${fields} fields sent`,
  sysReadsBack: (read: string[]) => `reads back ${read.join(', ')}`,
  sysConfirm: (hours: number, system: string) => `waits up to ${hours}h for ${system} to confirm`,
  sysThenChecks: 'then checks it matches the ledger',

  /* §1.11 */
  dwNotLicensed: (name: string) => `${name} isn’t licensed for this org`,

  /* §1.12 */
  theHiringManager: 'the hiring manager',
  theirManager: 'their manager',

  /* §2.4 */
  needsInformation: 'Needs information',
  needsInformationBit: (labels: string[], step: string, owner: string) =>
    `Needs information: ${labels.join(', ')} ${labels.length > 1 ? 'are' : 'is'} missing, so “${step}” can’t decide. ${owner} has been asked to fill it in`,

  /* The owner's decision on resubmits, mine: why someone the record no longer calls for is still asked. */
  keptNote: (person: string) => `Stays on this: the requester’s change no longer calls for ${person}, but a resubmit can’t take anyone off`,
  briefKept: 'The requester’s change no longer calls for you, but a resubmit can’t take anyone off.',
  needInfoNobody: 'Nobody', // mine (item H)
  /* Mine: 03 §14.4 makes the switch immediate, so an overlap it causes is said, not stopped. */
  overlapAfterSwitch: (other: string) => `This overlaps “${other}” and nothing says which one runs. Until someone chooses, Levv runs the one listed first. Publish a change to choose.`,

  /* §3.2 */
  overlapRunLog: (name: string) => `Two workflows overlap; ran “${name}” by priority.`,

  /* §4 */
  insidePlan: 'Inside plan',
  outsidePlan: 'Outside plan',
  passed: 'Passed',
  flagged: 'Flagged',

  /* §5 */
  rateNoRate: 'No rate on this record',
  rateResult: (card: number, market: number) =>
    `${card}% over rate card, ${market >= 0 ? `${market}% over` : `${Math.abs(market)}% under`} market median`,
  budgetNoData: 'No budget data on this record',
  budgetLeft: (left: string) => `${left} left in plan after this request`,
  budgetOver: (over: string) => `${over} over the approved plan`,
  dupAccessFound: 'This person already has an active badge from an earlier request',
  dupAccessClear: 'No active badge or open request for this person',
  dupFound: 'Same person is active through another supplier (WO-1877)',
  dupClear: 'No duplicate worker or leftover access found',
  tenureNoData: 'No tenure data',
  tenureResult: (months: number) => `${months} months engaged after this change (cap 18)`,
  workerCompleted: (name: string) => `${name} completed`,

  /* §6.2 */
  basisChange: (change: string, was: string, now: string) =>
    `Comparing the change amount: ${change} (was ${was}, now ${now})`,
  basisRunning: (running: string, orig: string, change: string) =>
    `Comparing the running total of changes: ${running} since the original ${orig}. This change alone is ${change}`,

  /* §6.5 */
  onlyNeededWhen: (condition: string) => `only needed when ${condition}`,
  approvedTheOriginal: 'approved the original; nothing they depend on changed',
  inOrderLabel: (step: string, i: number, n: number) => `${step} (${i} of ${n})`,

  /* §6.7 */
  noEligibleAny: (roles: string[]) => `no eligible ${roles.join(' or ')}`,
  chargedTo: (cc: string) => `Charged to ${cc}, so its cost center owner approves`,
  hiringManagerOnRecord: (hm: string, requester: string) =>
    `${hm} is the hiring manager on the record (raised by ${requester})`,
  noEligibleReviewer: (role: string, country: unknown) => `no eligible ${role} reviewer for ${String(country)}`,
  selfSpecialistBackup: (p: string, role: string, backup: string) =>
    `${p} raised this request, so another ${role} reviewer, ${backup}, approves`,
  selfSpecialistPaused: (p: string, role: string) => `${p} raised this and no other ${role} reviewer is set`,
  selfMovesUp: (p: string, up: string, jobTitle?: string) =>
    `${p} raised this request, so the step moves up to ${up}${jobTitle ? ` (${jobTitle})` : ''}`,
  /* AGENTS rule 4, mine: the same sentences as the requester's, for the worker. */
  workerSpecialistBackup: (p: string, role: string, backup: string) =>
    `${p} is the worker on this request, so another ${role} reviewer, ${backup}, approves`,
  workerSpecialistPaused: (p: string, role: string) => `${p} is the worker on this request and no other ${role} reviewer is set`,
  workerMovesUp: (p: string, up: string, jobTitle?: string) =>
    `${p} is the worker on this request, so the step moves up to ${up}${jobTitle ? ` (${jobTitle})` : ''}`,
  workerNobodyAbove: (p: string) => `${p} is the worker on this request and nobody is set above them`,
  workerNeverApproves: 'the worker can’t approve a request',
  signingLimit: (p: string, limit: string, up: string) => `${p}’s signing limit is ${limit}, so it moves up to ${up}`,
  awayDelegated: (p: string, until: string, delegate: string) => `${p} is out until ${until}. Delegated to ${delegate}`,
  awayBackup: (p: string, until: string, delegate: string, role: string, backup: string) =>
    `${p} is out until ${until}. Their delegate ${delegate} isn’t eligible for ${role} decisions, so ${backup} (backup) approves`,
  awayNoDelegate: (p: string) => `${p} is away and has no eligible delegate`,
  namedAwayBackup: (p: string, until: string, backup: string) => `${p} is out until ${until}, so ${backup} (backup) approves`,
  namedAwayNoBackup: (p: string) => `${p} is away and no backup is set`,
  pausedNote: (why: string, owner: string) =>
    `Paused: ${why}. It waits until someone eligible is assigned (owner: ${owner}). No one unqualified stands in`,

  /* §6.8 */
  groupText: (name: string, mode: 'all' | 'any', members: string[]) =>
    `${name}: ${mode === 'all' ? 'all of ' : 'any one of '}${members.join(', ')}`,

  /* §6.10 */
  alsoCovers: (p: string, role: string, later: boolean) =>
    `${p} also covers ${role}${later ? ' (a later step)' : ''}. Same kind of decision, so one approval`,
  alsoGives: (p: string, other: string, thisClass: string) =>
    `${p} also gives the ${other}. This is ${/^[aeiou]/i.test(thisClass) ? 'an' : 'a'} ${thisClass}, a different decision, so they’re asked separately`,

  /* §6.13 */
  briefHeader: (step: string, recordTitle: unknown, recordId: string) => `${step}: ${String(recordTitle)} (${recordId})`,
  briefApproveAs: (role: string, suffix: string) => `What’s asked: approve as ${role}${suffix}.`,
  briefTogetherWith: (others: string[]) => `, together with ${others.join(', ')}`,
  briefStepOf: (i: number, n: number) => ` (step ${i} of ${n})`,
  briefAnyOne: (roles: string[]) => `What’s asked: approve as one of ${roles.join(' or ')}. The first answer counts.`,
  briefGroup: (group: string, mode: 'all' | 'any') =>
    `What’s asked: approve for ${group}. ${mode === 'all' ? 'Everyone in the group approves.' : 'Any one of the group is enough.'}`,
  briefEscalation: 'What’s asked: decide. Approve to carry on, reject with a comment to stop, or send it back to the requester.',
  briefFailedCheck: (step: string) =>
    `What’s asked: decide whether to carry on after “${step}” failed. Approve to carry on, reject to stop.`,
  briefWhy: (why: string) => `Why it’s here: ${why}.`,
  briefRule: (name: string, condition: string) => `Added by the company-wide rule “${name}”: ${condition}.`,
  briefChanged: (changes: string[]) => `What changed: ${changes.join('; ')}.`,
  briefChangedNothing: 'What changed: nothing in the fields Levv compares.',
  briefChange: (label: string, from: string, to: string) => `${label} ${from} → ${to}`,
  briefBasis: (basis: string) => `${basis}.`,
  briefChecks: (results: string[]) => `Checks: ${results.join('; ')}.`,
  briefCheck: (name: string, ok: boolean, m: string) => `${name} ${ok ? 'passed' : 'flagged'}: ${m}`,
  briefFlags: (labels: string[]) => `Marked: ${labels.join(', ')}.`,
  briefOnBehalfRole: (role: string, person: string) => `On behalf of ${role} (${person}).`,
  briefOnBehalfPerson: (person: string) => `On behalf of ${person}.`,
  yes: 'yes',
  no: 'no',

  /* §7 */
  companyWideRule: (condition: string) => `Company-wide rule: ${condition}`,
  taskFallback: 'Task',
  ruleTaskLine: (taskTitle: string, role: string, person: string) =>
    `Task: ${taskTitle} · ${role} (${person}). Must be done before the request is approved`,

  /* §8.3 */
  conflictBadge: 'Conflict' as const,
  conflictMessage: (field: string, av: string, aBy: string, bv: string, bBy: string) =>
    `Two proposed changes to the ${field.toLowerCase()}: ${av} from ${aBy} and ${bv} from ${bBy}. Nothing is overwritten; approvals wait until one version is chosen.`,
  conflictUse: (v: string) => `Use ${v}`,
  conflictChosen: (v: string, by: string, otherBy: string) =>
    `Using ${v} from ${by}. ${otherBy} has been told, and approval links for the other version no longer work.`,
  conflictSummary: 'Nothing is approved yet: approvals wait until one of the two proposed changes is chosen',
  undo: 'Undo' as const,

  /* §8.4 */
  tryEdit: (label: string) => `Try an edit: ${label}`,
  undoEdit: 'Undo the edit',
  statusApproved: 'Approved',
  statusStands: 'Stands',
  statusAskedAgain: 'Asked again',
  statusWaiting: 'Waiting',
  statusNew: 'New',
  removedApproved: (role: string) => `${role}: approved, no longer needed`,
  removedWithdrawn: (role: string) => `${role}: withdrawn, approver told`,

  /* §9 */
  insideThePlan: 'Inside the plan',
  outsideThePlan: 'Outside the plan',
  fitsBudget: 'Fits the budget Finance approved',
  outsideBudget: 'Outside the approved budget, so it goes to an approver',
  approvedAutomatically: 'Approved automatically',
  notUsed: 'Not used',
  someoneApproves: 'Someone approves on this path, so it doesn’t auto-approve',

  /* §10.3 */
  done: 'Done',
  nothingListedYet: 'nothing listed yet',
  askedOf: (who: string, items: string) => `Asked of ${who}: ${items}`,
  failedDecisionNeeded: 'Failed: decision needed',
  failedMustDecide: (ask: string, roles: string[]) => `${ask}. Failed. ${roles.join(' and ')} must decide whether to carry on`,
  failedNobodySet: (ask: string) => `${ask}. Failed. Nobody is set to decide yet`,
  failedEscalated: 'Failed: escalated',
  failedEscalatedTo: (ask: string, who: string) =>
    `${ask}. Failed. Escalated to ${who}: they approve to carry on, reject with a comment, or send it back`,
  review: (role: string) => `Review: ${role}`,
  waitingFor: (ask: string, who: string) => `${ask}. Waiting for ${who}`,
  unsure: (role: string) => `Unsure: ${role}`,
  checkerUnsure: (ask: string, checker: string, who: string) => `${ask}. ${checker} wasn’t sure, so ${who} reviews`,
  verifiedAutomatically: 'Verified automatically',
  verifiedBy: (ask: string, checker: string) => `${ask}. Verified by ${checker}`,
  seesInProgress: 'In progress',
  seesNotStarted: 'Not started yet',
  seesWaitingForReview: 'Waiting for review',
  taskDone: (taskTitle: string, who: string) => `${taskTitle}: done by ${who}`,
  taskToDo: (role: string) => `To do: ${role}`,
  taskLine: (taskTitle: string, who: string) => `${taskTitle}: ${who}`,
  doneIn: (system: string) => `Done in ${system}`,
  doneByWorker: (name: string) => `. Done by the ${name} Digital Worker`,
  ledgerLine: (gives: string, disp: string) => `. Ledger: ${gives} (${disp.toLowerCase()} at exit)`,
  pausedNotConnected: 'Paused: not connected',
  sent: 'Sent',
  sentTo: (channel: string, who: string[]) => `${channel} to ${who.join(', ')}`,
  noOneToTell: 'No one to tell',
  pickWhoToTell: 'Pick who to tell',
  waits: 'Waits',
  started: 'Started',
  starts: (target: string) => `Starts “${target}”`,
  pickWorkflow: 'Pick a workflow',

  /* §10.4 */
  chooseWhoApproves: 'Choose who approves',
  pickWhoApproves: 'Pick who approves this step. Nothing is approved automatically',
  paused: 'Paused',
  pausedMessage: 'Nobody eligible right now, so it waits until someone is assigned. Nothing is approved automatically',
  escalated: 'Escalated',
  escalatedMessage: 'They must approve (it carries on), reject with a comment (it stops), or send it back to the requester',
  approval: 'Approval',
  modePrefix: { all: 'Together. ', any: 'Any one. ', order: 'In order. ' },
  ifRejected: {
    requester: 'If rejected: back to the requester to fix',
    previous: 'If rejected: back one step',
    end: 'If rejected: the request is rejected',
  },
  notNeeded: 'Not needed',
  notAskedAgain: 'Not asked again',
  covered: 'Covered',
  coveredMessage: 'The same person already approves this kind of decision on this path',
  chaserLine: (remind: number, to: string, sla: number) => `. Chaser reminds after ${remind}h and escalates to ${to} after ${sla}h`,

  /* §10.5 */
  waiting: 'Waiting',
  waitingOn: (blockers: string[]) => `Waiting on ${blockers.join(', ')}`,

  /* §11 */
  inactiveNotice: 'This workflow is inactive. Real requests don’t use it. Below is what it would do if you turned it back on.',
  markedLine: (labels: string[]) => `Marked: ${labels.join(', ')} (later steps can react to this)`,
  forRealRequests: (winner: string) => `For real requests, “${winner}” runs for this record.`,
  noSampleRecords: 'No sample records for this trigger yet.',
  fromApprovalRulesTitle: 'From approval rules',
  removedByEditTitle: 'Removed by the edit',
  decisionChip: (step: string, label: string) => `${step} → ${label}`,

  /* §11.1 */
  rounds: (n: number) => `${n} approval ${plural(n, 'round')} on this path`,
  noOneApproves: 'No one needs to approve on this path',
  rulesAdd: (names: string[]) => `Approval rules add approvers: ${names.join(', ')}`,
  approvedNoOneActed: 'Approved automatically. No one had to act',
  rejectedAt: (by: string, recipients: string[]) =>
    `Rejected at “${by}”. It goes back to the requester with the reason${recipients.length ? `; Levv tells ${recipients.join(', ')}` : ''}`,
  stoppedAt: (by: string, told: string[]) => `Stopped at “${by}”. Levv tells ${told.join(', ')}`,
  partPaused: 'Part of the approval is paused: nobody eligible, so it waits until someone eligible is assigned',

  /* §12.1 */
  novaChecked: (recs: number) => `Nova checked this flow against ${recs} real ${plural(recs, 'record')} from the last 90 days.`,
  novaDesignOnly: 'No past records would have reached this flow. Nova checked the design only.',
  looksGood: 'Looks good',
  nothingToFix: 'Nothing to fix.',
  severityLabel: { bad: 'Fix before publishing', warn: 'Check', tip: 'Suggestion', info: '' },
  showMe: 'Show me',
  chooseWhichWins: 'Choose which wins',
  fixButton: (label: string) => `✦ ${label}`,

  /* §12.2 */
  l1: (t: string) => `“${t}” doesn’t ask for anything yet.`,
  l2: (t: string, gives: string) => `“${t}” gives ${gives} but has no reverse step, so offboarding would leave it behind.`,
  l2Fix: 'Add a reverse step',
  l2Reverse: (gives: string) => `Remove ${gives}`,
  l2Toast: (reverse: string) => `Added reverse step “${reverse}”`,
  l3: (t: string, system: string) => `“${t}” creates something in ${system} that isn’t in the ledger, so offboarding won’t know to remove it.`,
  l3Fix: 'Record it in the ledger',
  l3Gives: (system: string) => `${system} account`,
  l3Reverse: (system: string) => `Close ${system} account`,
  l3Toast: 'Recorded in the ledger, with a reverse step',
  l4: (t: string) => `“${t}” sends every path to the same place, so it does nothing yet.`,
  l5: (t: string, target: string) => `“${t}” starts “${target}”, which starts this workflow again. They would start each other forever.`,
  l6: 'Things are given to workers, but there is no Offboarding workflow to take them back.',
  l7: (t: string, person: string) => `“${t}” names ${person} with no backup. If they’re away, it pauses.`,
  l8: (t: string, system: string) => `“${t}” uses ${system}, which isn’t connected yet. It will give the work to a person until it is.`,
  l9: (t: string) => `“${t}” doesn’t tell anyone yet.`,
  l10: (path: string, t: string, notLast: boolean) =>
    `Path “${path}” in “${t}” has no conditions, so it matches everything${notLast ? ' and the paths below it never run' : ''}.`,
  l11: (t: string) => `“${t}” doesn’t say who approves yet.`,
  l12: (t: string) => `“${t}” doesn’t say who decides when it fails.`,
  l13: (t: string) => `“${t}” can’t be reached from Start, so it never runs.`,
  l14Bad: (name: string, count: number, self: string, other: string) =>
    `Overlaps with “${name}” on ${count} past records (${self} and ${other}). Set which one wins before publishing.`,
  l14Info: (name: string, count: number, self: string, other: string) =>
    `Overlaps with “${name}” on ${count} past records (${self} and ${other}). Priority decides which runs.`,
  l15: (t: string) => `“${t}” asks the worker to approve or decide. The worker can’t approve, review or be escalated to.`,
  l16: (t: string) => `“${t}” doesn’t say which workflow to start.`,
  l17: (t: string) => `“${t}” doesn’t have a date and time yet.`,
  l18: (t: string) => `“${t}”: escalation has to come after the reminder.`,

  /* §13.1 */
  publishTitle: (name: string) => `Publish “${name}”`,
  impact: (recs: number) =>
    `Applies to new runs. ${recs} ${plural(recs, 'record')} in the last 90 days would have started this workflow. Anything already running keeps its current version.`,
  mustFixRow: (message: string) => `× ${message}`,
  overlapQuestion: (other: string, count: number) => `This overlaps “${other}” on ${count} ${plural(count, 'record')}. Which one should run?`,
  overlapPlaceholder: 'Choose…',
  readyToSend: '✓ Ready to send for approval.',
  goesLiveOn: 'Goes live on',
  pickLaterDate: 'Pick today or a later date.',
  cancel: 'Cancel',
  sendForApproval: 'Send for approval',
  nobodyElseCanApprove: 'Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission.',

  /* §13.4, §13.5 */
  sentForApproval: 'Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.',
  close: 'Close',
  cannotApproveOwn: 'You can’t approve your own change.',
  /* Decision 5, mine: answers of the account-links route. */
  linkNotAMember: 'That account isn’t a member of this organisation.',
  linkNotAPerson: 'That person isn’t in this organisation’s reference data.',
  linkNotATeam: 'No workflow is owned by that team.',
  linkTaken: 'That person is already linked to another account. Unlink them first.',
  notLinked: 'Your account isn’t linked to a person in Flow Studio yet, so you can’t approve this. Ask an admin to link it.', // mine (decision 5)
  overlapOpenAtApproval: (other: string) => `This now overlaps “${other}”, which went live after it was sent. Reject it so the author can choose which one runs, then send it again.`, // mine (finding 13)
  noApprovePermission: 'You don’t have the “Approve flow changes” permission.',
  nothingWaiting: 'This change isn’t waiting for approval.',
  publishBlocked: 'Fix what Nova flags before sending this for approval.',
  draftConflict: 'This workflow changed since you opened it. Reload to see the latest.',
  alreadyWaiting: 'This workflow is already waiting for approval.',
  noSuchOverlap: 'That choice isn’t about a workflow this one overlaps.',
  runControlForbidden: 'Only the workflow owner or an admin can pause, resume or stop it.',
  stopReasonRequired: 'A reason is required to stop a workflow.',
  publishedToast: (version: number, date: string) => `Published as v${version}, live on ${date}`,

  /* §13.6 */
  statusWaitingForApproval: 'Waiting for approval',
  statusInactive: (version: number) => `Inactive · v${version}`,
  statusDraft: 'Draft',
  statusDirty: (version: number) => `Live v${version} · unpublished changes`,
  statusLive: (version: number) => `Live v${version}`,
  pickerInactivePrefix: 'Inactive · ',

  /* §14 */
  activeDraftTitle: 'Draft',
  activeDraftText: 'Publish it to make it active.',
  activeLiveTitle: 'Active',
  activeLiveText: 'New events start this workflow.',
  activeInactiveTitle: 'Inactive',
  activeInactiveText: 'Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.',
  inactiveWarning: (record: string, records: string) =>
    `No other active workflow covers every ${record}, so new ${records} that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.`,
  activeAgainToast: (name: string) => `“${name}” is active again`,
  inactiveToast: (name: string) => `“${name}” is inactive. It can’t be deleted, only turned back on`,
  builtIn: (short: string) =>
    `🔒 Built in: Levv only starts this once the ${short}. Anything that arrives earlier waits, and the owner is told if it waits more than 7 days.`,

  /* 02 §5.14, §16.13: names and text of new steps and workflows */
  newStep: {
    cond: 'Over $500K?',
    appr: 'Approval',
    policy: 'Auto-approve',
    receipt: 'Approved automatically',
    plan: 'Fits plan?',
    planName: 'Cost center plan, this quarter',
    collect: 'New requirement',
    task: 'New task',
    taskTitle: 'Enter the PO number',
    system: 'System step',
    notify: 'Notify',
    wait: 'Wait',
    parallel: 'Run together',
    runwf: 'Run workflow',
    workflow: 'New workflow',
    owner: 'Procurement operations',
  },

  /* §16 */
  atLeastOnePath: 'At least one path has to carry on',
  otherwise: 'Otherwise',
  labelNo: 'No',
  labelYes: 'Yes',
  rejected: 'Rejected',
  stopped: 'Stopped',
  pathApprovalLabel: (path: string) => `${path}: approval`,
  pathEscalationLabel: (path: string) => `${path}: escalation`,
  pathStopLabel: (path: string) => `${path}: tell them it stopped`,
  pathLabel: (k: number) => `Path ${k}`,
  pathDeleted: 'Path deleted',
  flagEscalationLabel: (worker: string) => `${worker} flagged: escalation`,
  flagStopLabel: 'Tell them it stopped',
  panelFlagEscalate: 'They must act. Approve (it carries on), reject with a comment (it stops), or send it back to the requester.',
  panelFlagAlways: 'If it passes, it carries on. Either way, the result goes into every approver’s brief.',
  stepDeleted: 'Step deleted. Lines reconnected',
  branchLabel: (n: number) => `Branch ${n}`,
  pathsNeverMeet: 'These paths never meet',
  addedAfterPathsMeet: 'Added after all paths meet',
  fixSystemLabel: (system: string) => `Fix the ${system} error`,
  fixSystemTitle: (system: string) => `Fix what failed in ${system}, then retry`,
  systemExitDone: 'Done',
  systemExitFailed: 'Failed',
  collectExitFailed: 'Failed',
  collectFailedLabel: (step: string) => `${step} failed: escalation`,
  escalationAfterReminder: 'Escalation has to come after the reminder.',
  workerNowVerifies: (name: string, step: string) => `${name} now verifies “${step}”`,
  workerNowDoes: (name: string, step: string) => `${name} now does “${step}”`,
  checksGoOnLine: 'Checks go on the line before an approver: drop it on a +',
  newDraftToast: 'New draft. Set when it runs, then press + to add steps',

  /* §17 */
  sayWhen: 'Say when this approver is needed',
  readAs: (condition: string) => `Read as: asked only if ${condition}. Check it below, then Test.`,
  couldNotMatch: 'I couldn’t match that to a field. Try naming the field and value, e.g. “work country is Canada” or “total value over $250K”.',
  whenPlaceholder: 'e.g. the bill rate goes up more than 5%, or the work country is UK',
  gptSystem: (fields: string) =>
    `You turn a sentence about when an approver is needed into condition rows. Use only these fields (id, label, type, options): ${fields}. Operators by type: money/num/pct: >=, >, <, <=; enum: in, not_in (v is a list of options, spelled exactly); bool: yes, no (no v); list: includes (v is one option); text: is, contains. Percent values are plain numbers (15 means 15%). Money is in dollars (250K = 250000). Return {join, rows}. join is 'any' only if the sentence says 'or' or 'any of'. If nothing matches, return rows: [].`,

  /* §18.1 */
  receiptKept: 'Receipt kept',
  outsidePlanSubtitle: (roles: string) => `Outside plan: ${roles}`,
  flagSubtitle: {
    note: 'If flagged: approvers see it',
    escalate: (who: string) => `If flagged: escalate to ${who}`,
    reject: 'If flagged: rejected',
    stop: 'If flagged: stop',
  },
  provides: (role: string) => `${role} provides`,
  thenReviewer: (checker: string, reviewer: string) => `${checker}, then ${reviewer}`,
  unassigned: 'Unassigned',
  givesSuffix: (gives: string) => ` · gives ${gives}`,
  backupSuffix: (backup: string) => ` · backup ${backup}`,
  noBackupSuffix: ' · no backup',
  onlyIfSuffix: (condition: string) => ` · only if ${condition}`,
  subtitleMode: { all: 'Together: ', any: 'Any one: ', order: 'In order: ' },
  cardCarriesOn: 'carries on',
  cardApproval: (who: string) => `approval · ${who}`,
  cardEscalate: (who: string) => `escalate · ${who}`,
  cardRejected: 'rejected',
  cardStop: 'stop',
  cardLane: (first: string, more: number) => `→ ${first}${more > 0 ? ` +${more}` : ''}`,
  cardOwnSteps: 'its own steps',
  lineApproval: (who: string) => `approval by ${who}`,
  lineEscalated: (who: string) => `escalated to ${who}`,

  /* §18.2 */
  ifTopLine: (elseLabel: string, merge: string) =>
    `Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “${elseLabel}”. All paths meet again at “${merge}”.`,
  endTitle: 'End',
  takePathWhen: (join: 'all' | 'any') => `Take this path when ${join} of these are true:`,
  carryOnTo: (merge: string) => `Carry on to “${merge}”`,
  thenCarriesOn: (merge: string) => `Then it carries on to “${merge}”.`,
  escalateExplain: 'They must act: approve (it carries on), reject with a comment, or send it back to the requester.',
  customPath: (steps: string[]) =>
    `On this path: ${steps.join(' → ') || 'nothing'}. Click a box on the canvas to change it, or pick another option to replace it.`,
  otherwiseCard: 'when none of the paths above match',

  /* §18.3 */
  approveRolesSentence: (roles: string[], howMany: string) =>
    `${roles.join(', ')} approve${howMany}. Levv finds the right person for each request.`,
  approveHowMany: { all: ', together', any: ', any one of them is enough', order: ', one after another' },
  approvePickRoles: 'Pick roles. Levv finds the right person for each request.',
  approveGroupSentence: (group: string, members: string[], mode: 'all' | 'any') =>
    `${group}: ${members.join(', ')}. ${mode === 'all' ? 'Everyone in the group approves.' : 'Any one of them can approve.'}`,
  approvePersonSentence: 'A named person doesn’t follow reorgs. If they leave or change role, Nova flags every step that names them.',
  approveBriefNote: '✦ Approvers get a brief: what’s asked, what changed, and the result of any checks earlier on the line.',
  chooseGroup: 'Choose a group',
  choosePerson: 'Choose a person',
  chooseRoles: 'Choose roles',

  /* §18.4 */
  chaserTitle: 'Chaser',
  chaserBuiltIn: 'built in',
  chaserRemindLabel: 'Remind after (hours)',
  chaserEscalateLabel: (to: string) => `Then escalate to ${to} after (hours)`,
  chaserRuns: 'Runs by itself while this step waits. Reminders stop the moment someone acts.',
};
