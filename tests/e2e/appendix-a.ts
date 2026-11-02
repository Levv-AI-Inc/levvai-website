/**
 * 04 Appendix A, transcribed by hand from the document, never from the app. Where the Appendix is silent (for example
 * "the same shape"), nothing is asserted beyond what it says, plus the box count, which comes from the seed file.
 *
 *   boxes:  "Title / subtitle" as the canvas must show them; a bare title when the Appendix gives no subtitle
 *   ifs:    If cards: [row name, outcome]. `null` outcome: the Appendix names the row but not its outcome
 *   exits:  exit labels shown on a box, in stored order
 *   flow:   "A → B" in the Appendix: B comes after A on the canvas, reachable from it
 *   lines:  an explicit connection, one edge: an exit that goes to a box, or "which rejoins"
 */
export interface ExpectedCanvas {
  id: string;
  name: string;
  status?: string;
  start?: [string, string];
  boxes: string[];
  ifs?: { name: string; rows?: [string, string | null][] }[];
  exits?: Record<string, string[]>;
  flow?: string[][];
  lines?: [string, string][];
  helpers?: Record<string, string>;
}

const EVERYWHERE = 'Everywhere';

const onboardingEscalation = (step: string, role: string): string => `${step} failed: escalation / ${role}`;

export const APPENDIX_A: ExpectedCanvas[] = [
  {
    id: 'wf-wo-sub',
    name: 'Work order submitted',
    status: 'Live v1',
    start: ['Work order submitted', EVERYWHERE],
    boxes: [
      'Budget check / If flagged: approvers see it',
      'Duplicate & ghost worker / If flagged: escalate to Procurement',
      'Duplicate found: escalation / Procurement',
      'Business sign-off / Together: Hiring manager + Cost center owner',
      'Rate review / Procurement',
      'Executive sign-off / In order: VP Finance + CFO',
      'Finance sign-off / Finance business partner',
      'Tell the supplier / Supplier account manager',
      'End / Completed',
    ],
    ifs: [
      { name: 'Rate over card?', rows: [['Over 10%', '→ Rate review'], ['Otherwise', 'carries on']] },
      { name: 'Value band', rows: [['Over $1M', '→ Executive sign-off'], ['Over $250K', '→ Finance sign-off'], ['Otherwise', 'carries on']] },
    ],
    exits: { 'Budget check': ['Flagged', 'Passed'], 'Duplicate & ghost worker': ['Flagged', 'Passed'] },
    flow: [['Work order submitted', 'Budget check', 'Duplicate & ghost worker', 'Business sign-off', 'Rate over card?', 'Value band', 'Tell the supplier', 'End']],
    lines: [
      ['Duplicate & ghost worker', 'Duplicate found: escalation'],
      ['Rate over card?', 'Rate review'],
      ['Value band', 'Executive sign-off'],
      ['Value band', 'Finance sign-off'],
    ],
  },
  {
    id: 'wf-wo-sub-wo-uk-tech',
    name: 'UK Technology work orders',
    status: 'Live v3',
    start: ['Work order submitted', 'UK · Technology'],
    boxes: [
      "Business sign-off / Together: Hiring manager's manager + Cost center owner",
      'Rate review with Finance / Together: Procurement + Finance business partner',
      'Rate review',
      'Finance sign-off / VP Finance',
      'Executive sign-off / In order: VP Finance + CFO',
    ],
    ifs: [
      { name: 'Rate over card?', rows: [['Over 20%', '→ Rate review with Finance'], ['Over 10%', '→ Rate review'], ['Otherwise', null]] },
      { name: 'Value band' },
    ],
    flow: [['Business sign-off', 'Rate over card?', 'Value band']],
    lines: [['Value band', 'Finance sign-off'], ['Value band', 'Executive sign-off']],
  },
  {
    id: 'wf-wo-sub-wo-data',
    name: 'Data and AI hires',
    status: 'Draft',
    start: ['Work order submitted', 'Data'],
    boxes: [
      'Budget check',
      'Duplicate & ghost worker',
      'Business sign-off / Together: Hiring manager + Cost center owner',
      'Data governance review / Privacy',
      'Tell the supplier',
      'End',
    ],
    flow: [['Budget check', 'Duplicate & ghost worker', 'Business sign-off', 'Data governance review', 'Tell the supplier', 'End']],
  },
  {
    id: 'wf-onboard',
    name: 'Contractor onboarding',
    status: 'Live v1',
    start: ['Onboarding starts', EVERYWHERE],
    boxes: [
      'Collect in parallel / Insurance · Equipment · Legal · Workday · Identity',
      'Vendor insurance / Supplier account manager provides · Procurement',
      onboardingEscalation('Vendor insurance', 'People Ops'),
      'Laptop and badge / IT service desk provides · IT service desk',
      onboardingEscalation('Laptop and badge', 'People Ops'),
      'Legal & compliance / Worker provides · E-signature',
      onboardingEscalation('Legal & compliance', 'People Ops'),
      'Workday provisioning / Create contingent worker in Workday · gives Workday account',
      'Identity & eligibility / Worker provides · Persona, then People Ops',
      onboardingEscalation('Identity & eligibility', 'People Ops'),
      'Background check / Worker provides · Checkr',
      'Registration verified / Worker provides · Compliance',
      onboardingEscalation('Registration verified', 'People Ops'),
      'System access / Create access request in ServiceNow · gives System access',
      'Wait for start date / Until Start date, 09:00',
      'Payroll & banking / Worker provides · Workday, then People Ops',
      onboardingEscalation('Payroll & banking', 'People Ops'),
      'End / Completed',
    ],
    ifs: [{ name: 'Registration required?', rows: [['Yes', '→ Registration verified'], ['No', 'carries on']] }],
    exits: {
      'Collect in parallel': ['Insurance', 'Equipment', 'Legal', 'Workday', 'Identity'],
      'Vendor insurance': ['Done', 'Failed'],
      'Laptop and badge': ['Done', 'Failed'],
      'Legal & compliance': ['Done', 'Failed'],
      'Identity & eligibility': ['Done', 'Failed'],
      'Registration verified': ['Done', 'Failed'],
      'Payroll & banking': ['Done', 'Failed'],
    },
    flow: [['Onboarding starts', 'Collect in parallel', 'Background check', 'Registration required?', 'System access', 'Wait for start date', 'Payroll & banking', 'End']],
    lines: [
      ['Collect in parallel', 'Vendor insurance'],
      ['Collect in parallel', 'Laptop and badge'],
      ['Collect in parallel', 'Legal & compliance'],
      ['Collect in parallel', 'Workday provisioning'],
      ['Collect in parallel', 'Identity & eligibility'],
      ['Vendor insurance', 'Vendor insurance failed: escalation'],
      ['Vendor insurance failed: escalation', 'End'],
      ['Laptop and badge', 'Laptop and badge failed: escalation'],
      ['Laptop and badge failed: escalation', 'End'],
      ['Legal & compliance', 'Legal & compliance failed: escalation'],
      ['Legal & compliance failed: escalation', 'Registration required?'],
      ['Identity & eligibility', 'Identity & eligibility failed: escalation'],
      ['Identity & eligibility failed: escalation', 'Background check'],
      ['Registration required?', 'Registration verified'],
      ['Registration verified', 'Registration verified failed: escalation'],
      ['Registration verified failed: escalation', 'System access'],
      ['Payroll & banking', 'Payroll & banking failed: escalation'],
      ['Payroll & banking failed: escalation', 'End'],
    ],
    helpers: { 'System access': 'Access provisioner' },
  },
  {
    id: 'wf-offboard',
    name: 'Contractor offboarding',
    status: 'Live v1',
    start: ['Offboarding starts', EVERYWHERE],
    boxes: [
      'Before the last day / Handover · Final time · Equipment · Obligations',
      'Knowledge handover / Hiring manager',
      'Final timesheet & expenses / Worker provides · Hiring manager',
      onboardingEscalation('Final timesheet & expenses', 'People Ops'),
      'Return equipment / IT service desk',
      'Exit confirmations / Worker provides · E-signature',
      onboardingEscalation('Exit confirmations', 'People Ops'),
      'Wait for the last day / Until End date, 17:00',
      'Remove access / Close or deactivate user in Okta',
      'Close in HR system / Close or deactivate contingent worker in Workday',
      'Ledger clear check / Check Okta matches the ledger',
      'Close the work order / Close or deactivate work order in SAP Fieldglass',
      'End',
    ],
    exits: {
      'Before the last day': ['Handover', 'Final time', 'Equipment', 'Obligations'],
      'Final timesheet & expenses': ['Done', 'Failed'],
      'Exit confirmations': ['Done', 'Failed'],
    },
    flow: [['Offboarding starts', 'Before the last day', 'Wait for the last day', 'Remove access', 'Close in HR system', 'Ledger clear check', 'Close the work order', 'End']],
    lines: [
      ['Before the last day', 'Knowledge handover'],
      ['Before the last day', 'Final timesheet & expenses'],
      ['Before the last day', 'Return equipment'],
      ['Before the last day', 'Exit confirmations'],
      ['Final timesheet & expenses', 'Final timesheet & expenses failed: escalation'],
      ['Final timesheet & expenses failed: escalation', 'Wait for the last day'],
      ['Exit confirmations', 'Exit confirmations failed: escalation'],
      ['Exit confirmations failed: escalation', 'Wait for the last day'],
    ],
  },
  {
    id: 'wf-ending',
    name: 'Assignment ending',
    status: 'Live v1',
    start: ['Assignment end date in 30 days', EVERYWHERE],
    boxes: [
      'Extend or end? / Hiring manager',
      'Tenure & classification / If flagged: approvers see it',
      'Tenure review / Together: HR business partner + Legal',
      'Within plan? / Outside plan: Cost center owner',
      'Budget owner / Cost center owner',
      'Finance sign-off / VP Finance',
      'Rate review / Procurement · only if Bill rate change (%) > 5%',
      'Auto-approve if no one else needed / Receipt kept',
      'Confirm the end date / Hiring manager + Supplier account manager',
      'End',
    ],
    ifs: [
      { name: 'Extending?', rows: [['Yes', '→ Tenure & classification'], ['No', '→ Confirm the end date']] },
      { name: 'Tenure over 18 months?' },
      { name: 'New total over $250K?' },
      { name: 'Rate changed?' },
    ],
    flow: [
      ['Extend or end?', 'Extending?', 'Tenure & classification', 'Tenure over 18 months?', 'Tenure review', 'Within plan?', 'Budget owner', 'New total over $250K?', 'Finance sign-off', 'Rate changed?', 'Rate review', 'Auto-approve if no one else needed', 'End'],
      ['Extending?', 'Confirm the end date', 'End'],
    ],
  },
  {
    // "… the same approval chain as above …": the boxes between are asserted through Assignment ending's text only.
    id: 'wf-asn-chg',
    name: 'Assignment changed',
    status: 'Live v1',
    start: ['Assignment changed', EVERYWHERE],
    boxes: [
      'Tenure & classification',
      'Auto-approve if no one else needed',
      'Tell the supplier / Supplier account manager',
      'End',
      'Tenure review / Together: HR business partner + Legal',
      'Within plan? / Outside plan: Cost center owner',
      'Budget owner / Cost center owner',
      'Finance sign-off / VP Finance',
      'Rate review / Procurement · only if Bill rate change (%) > 5%',
    ],
    ifs: [{ name: 'Tenure over 18 months?' }, { name: 'New total over $250K?' }, { name: 'Rate changed?' }],
    flow: [['Tenure & classification', 'Tenure over 18 months?', 'Within plan?', 'New total over $250K?', 'Rate changed?', 'Auto-approve if no one else needed', 'Tell the supplier', 'End']],
  },
  {
    id: 'wf-access',
    name: 'Site access request',
    status: 'Live v1',
    start: ['Access request submitted in Zip', EVERYWHERE],
    boxes: [
      'Duplicate & ghost worker / If flagged: escalate to Information Security',
      'Duplicate & ghost worker flagged: escalation / Information Security',
      'Security approves access / Information Security',
      'Identity & site details / Worker provides · Persona, then Information Security',
      'Identity & site details failed: escalation / Information Security',
      'Background check / Worker provides · Checkr',
      'Issue the badge / Create badge in Badge system · gives Site badge',
      'Badge ready / Worker + Sponsor',
      'End',
    ],
    exits: { 'Duplicate & ghost worker': ['Flagged', 'Passed'], 'Identity & site details': ['Done', 'Failed'] },
    flow: [['Duplicate & ghost worker', 'Security approves access', 'Identity & site details', 'Background check', 'Issue the badge', 'Badge ready', 'End']],
    lines: [
      ['Duplicate & ghost worker', 'Duplicate & ghost worker flagged: escalation'],
      ['Identity & site details', 'Identity & site details failed: escalation'],
      ['Identity & site details failed: escalation', 'Background check'],
    ],
  },
  {
    id: 'wf-invoice',
    name: 'Invoice received',
    boxes: ['Match the invoice / Invoice match', 'Release for payment / Update supplier invoice in SAP S/4HANA', 'Resolve exception / Accounts payable', 'End'],
    ifs: [{ name: 'Matches?', rows: [['Yes', '→ Release for payment'], ['No', '→ Resolve exception']] }],
    flow: [['Match the invoice', 'Matches?', 'End']],
  },
  {
    id: 'wf-doc',
    name: 'Document renewal',
    start: ['Worker document expiring in 30 days', EVERYWHERE],
    boxes: ['Renewed document / Worker provides · Document collector, then People Ops', 'Renewed document failed: escalation / HR business partner', 'End'],
    exits: { 'Renewed document': ['Done', 'Failed'] },
    flow: [['Renewed document', 'End']],
    lines: [
      ['Renewed document', 'Renewed document failed: escalation'],
      ['Renewed document failed: escalation', 'End'],
    ],
  },
  {
    id: 'wf-jp',
    name: 'Job posting created',
    boxes: [
      'Within plan? / Outside plan: Cost center owner',
      'Approve within plan / Receipt kept',
      'Budget owner / Cost center owner',
      'Finance review / Finance business partner',
      'Send to suppliers / Procurement',
      'End',
    ],
    ifs: [{ name: 'Over $250K?', rows: [['Yes', '→ Finance review'], ['No', null]] }],
    exits: { 'Within plan?': ['Inside plan', 'Outside plan'] },
    flow: [['Within plan?', 'Budget owner', 'Over $250K?', 'Send to suppliers', 'End']],
    lines: [['Within plan?', 'Approve within plan'], ['Within plan?', 'Budget owner']],
  },
  ...(['wf-sow-sub', 'wf-sow-co'] as const).map((id): ExpectedCanvas => ({
    id,
    name: id === 'wf-sow-sub' ? 'SOW created' : 'SOW change order submitted',
    boxes: [
      'Procurement review / Procurement',
      'Legal review / Legal',
      'Finance and VP review / Together: Finance business partner + VP Finance',
      'Finance review / Finance business partner',
      'Tell the SOW owner it’s approved / SOW owner',
      'End',
    ],
    ifs: [
      { name: id === 'wf-sow-sub' ? 'Legal needed?' : 'Scope changed?', rows: [['Yes', '→ Legal review']] },
      { name: 'Value band', rows: [['Over $1M', '→ Finance and VP review'], ['Over $250K', '→ Finance review']] },
    ],
    flow: [['Procurement review', id === 'wf-sow-sub' ? 'Legal needed?' : 'Scope changed?', 'Value band', 'Tell the SOW owner it’s approved', 'End']],
  })),
  {
    id: 'wf-ts-sub',
    name: 'Timesheet submitted',
    boxes: [
      'Overtime approval / Together: Hiring manager + Cost center owner',
      'Approve scheduled hours / Receipt kept',
      'Tell the supplier it can invoice / Supplier account manager',
      'End',
    ],
    ifs: [{ name: 'Over schedule?', rows: [['Yes', '→ Overtime approval'], ['No', '→ Approve scheduled hours']] }],
    flow: [['Over schedule?', 'Tell the supplier it can invoice', 'End']],
  },
  {
    id: 'wf-wo-chg',
    name: 'Work order changed',
    boxes: ['Budget check', 'Duplicate & ghost worker', 'Duplicate found: escalation', 'Business sign-off', 'Finance sign-off', 'Executive sign-off', 'Tell the supplier', 'End'],
    ifs: [{ name: 'Rate over card?' }, { name: 'Value band' }],
    flow: [['Budget check', 'Duplicate & ghost worker', 'Business sign-off', 'Rate over card?', 'Value band', 'Tell the supplier', 'End']],
    lines: [['Duplicate & ghost worker', 'Duplicate found: escalation']],
  },
];

/** "so the 15 canvases hold 159 boxes in all" (04 Appendix A; 00 §8; 06 UI-NP-01). */
export const TOTAL_BOXES = 159;
