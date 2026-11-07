import { expect, test, type Page } from '@playwright/test';
import { boxText, canvasOf, choose, freshApp, norm, novaCount, openDetails, openStep, openWorkflow, optionTexts, panelOf, pickerButton, readBoxes, selectButton, waitForCanvas } from './helpers';
import { card, expectTestPanel, novaButton, novaPanelOf, openTest, radioRow, readNova, readRows, readTestPanel, testPanelOf } from './test-panel';

/** 06 B.2, UI-A1 to UI-A19, and B.4, UI-W1 to UI-W9. Every string is 06's, and "equals EN-xxx" reads EN-xxx out of 06. */

const WO = 'Work order submitted';
const UK = 'UK Technology work orders';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
});

const summaryOf = async (page: Page): Promise<string | null> => (await readTestPanel(page)).summary;

/** Where a line on the canvas goes, by the name of the box it reaches. */
async function lineEndsAt(page: Page, from: string, key: string): Promise<string> {
  const to = await canvasOf(page).locator(`path[data-from="${from}"][data-key="${key}"]`).getAttribute('data-to');
  return norm((await canvasOf(page).locator(`[data-node-id="${to}"] button`).first().getAttribute('aria-label')) ?? '');
}

async function goToUkAndTest(page: Page, record: string): Promise<void> {
  await openWorkflow(page, WO, UK);
  await expect(pickerButton(page, UK)).toBeVisible();
  await openTest(page, record);
}

test.describe('B.2 approval routing', () => {
  test('UI-A1 the variation runs, rules are added', async ({ page }) => {
    await openWorkflow(page, WO, UK);
    await expect(pickerButton(page, UK)).toBeVisible();
    await expect(page.getByRole('banner').getByText('Live v3', { exact: true })).toBeVisible();
    expect(await boxText(page, WO)).toBe('Work order submitted | UK · Technology');

    await openTest(page, 'Senior cloud engineer');
    const panel = testPanelOf(page);
    await expect(panel.getByRole('radiogroup')).toBeVisible();
    expect(await readRows(page)).toEqual([
      ['Senior cloud engineer', 'WO-2214 · Worked example 1'],
      ['Data engineer, trading data', 'WO-2240 · Regulated role, possible duplicate'],
      ['Operations analyst', 'WO-2231 · Catch-all flow, requester is an approver'],
      ['Cleared engineer, project Atlas', 'WO-2260 · Custom fields'],
      ['Data platform engineer, Germany', 'WO-2270 · No eligible Privacy reviewer; Security delegate not eligible'],
      ['Analytics lead, split funding', 'WO-2275 · Raised on behalf of the manager, two cost centers'],
      ['Ops contractor, no rate card yet', 'WO-2280 · Missing information'],
    ]);
    await expect(radioRow(page, 'Senior cloud engineer')).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByRole('heading', { name: 'Test', exact: true })).toBeVisible();
    await expect(panel.getByText('Senior cloud engineer', { exact: true }).first()).toBeVisible();
    expect(await summaryOf(page)).toBe('3 approval rounds on this path. Approval rules add approvers: Client data access, UK off-payroll (IR35).');
    expect((await card(page, 'Rate review')).rounds).toEqual(['1 Procurement (Owen Clarke)']);
    expect((await card(page, 'Finance sign-off')).rounds).toEqual(['1 VP Finance (David Okafor)']);
    expect((await card(page, 'Business sign-off')).tasks).toEqual(['Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved']);
    await expectTestPanel(page, 'EN-022');

    // ArrowDown moves the selection and re-runs Test; no pills.
    await radioRow(page, 'Senior cloud engineer').focus();
    await page.keyboard.press('ArrowDown');
    await expect(radioRow(page, 'Data engineer, trading data')).toHaveAttribute('aria-checked', 'true');
    await expect(radioRow(page, 'Data engineer, trading data')).toBeFocused();
    await expectTestPanel(page, 'EN-023');
    await page.keyboard.press('ArrowUp');
    await expectTestPanel(page, 'EN-022');
    await expect(panel.locator('[aria-pressed], input[type=radio], select')).toHaveCount(0);

    // Test stays open on the same record.
    await openWorkflow(page, UK, WO);
    await expect(pickerButton(page, WO)).toBeVisible();
    await expect(radioRow(page, 'Senior cloud engineer')).toHaveAttribute('aria-checked', 'true');
    expect((await readTestPanel(page)).notices).toContain('For real requests, "UK Technology work orders" runs for this record.');
    await expectTestPanel(page, 'EN-015');
  });

  test('UI-A2 nobody approves their own request', async ({ page }) => {
    await goToUkAndTest(page, 'Senior cloud engineer');
    const [round] = (await card(page, 'Business sign-off')).rounds;
    expect(round).toContain("Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)");
    expect(round.startsWith("1 Hiring manager's manager (Alan Brooks), Information Security (Ravi Kumar), Privacy (Fatima Zahra)")).toBe(true);
  });

  test('UI-A3 one person is asked once', async ({ page }) => {
    await goToUkAndTest(page, 'Senior cloud engineer');
    const [round] = (await card(page, 'Business sign-off')).rounds;
    expect(round).toContain('Alan Brooks also covers Cost center owner. Same kind of decision, so one approval');
    expect(round.split(' · ')[0]).not.toContain('Cost center owner');
  });

  test('UI-A4 a flagged check escalates first', async ({ page }) => {
    await goToUkAndTest(page, 'Data engineer, trading data');
    const escalation = await card(page, 'Duplicate found: escalation');
    expect(escalation.status).toBe('Escalated');
    expect(escalation.message).toBe('They must approve (it carries on), reject with a comment (it stops), or send it back to the requester. Chaser reminds after 24h and escalates to their manager after 48h');
    expect(escalation.rounds).toEqual(['1 Procurement (Owen Clarke)']);
    const check = await card(page, 'Duplicate & ghost worker');
    expect(check.status).toBe('Flagged');
    expect(check.message).toBe('Same person is active through another supplier (WO-1877)');
    expect((await card(page, 'Business sign-off')).rounds[0]).toContain('Compliance (Daniel Osei)');
    expect((await readTestPanel(page)).notices).toContain('Marked: Registration required (later steps can react to this)');
    await expectTestPanel(page, 'EN-023');
  });

  test('UI-A5 a flagged check can reject', async ({ page }) => {
    await openWorkflow(page, WO, UK);
    await expect(pickerButton(page, UK)).toBeVisible();
    await openStep(page, 'Duplicate & ghost worker');
    const panel = panelOf(page);
    const flag = selectButton(panel, 'If it flags something');
    await expect(selectButton(panel, 'Escalate to')).toHaveText('Procurement');
    expect(norm((await panel.getByText('They must act.', { exact: true }).locator('..').textContent()) ?? '')).toBe('They must act. Approve (it carries on), reject with a comment (it stops), or send it back to the requester.');
    await expect(panel.getByRole('spinbutton', { name: 'Escalate after (hours)' })).toHaveValue('48');
    await flag.click();
    expect(await optionTexts(page)).toEqual(['Carry on: the flag is recorded', 'Escalate: someone must decide', 'Reject it and send it back to the requester', 'Stop the workflow and tell someone']);
    await page.getByRole('option', { name: 'Reject it and send it back to the requester' }).click();

    const names = (await readBoxes(page)).map((box) => box.name);
    expect(names).not.toContain('Duplicate found: escalation');
    expect(await boxText(page, 'Rejected')).toBe('Rejected | Rejected');
    expect(await boxText(page, 'Duplicate & ghost worker')).toBe('Flagged | Passed | Duplicate & ghost worker | If flagged: rejected');
    expect(await lineEndsAt(page, 'RA_CD', 'flag')).toBe('Rejected');

    await openTest(page, 'Data engineer, trading data');
    expect(await summaryOf(page)).toBe('No one needs to approve on this path. Rejected at "Duplicate & ghost worker". It goes back to the requester with the reason; Levv tells Hiring manager.');
    await expect(testPanelOf(page).getByText('Approval rules add approvers')).toHaveCount(0);
    await expect(testPanelOf(page).getByText('Marked: Registration required (later steps can react to this)')).toHaveCount(0);
    await expectTestPanel(page, 'EN-042');

    // Cleanup, which 06 asserts too.
    await openStep(page, 'Duplicate & ghost worker');
    await choose(panelOf(page), 'If it flags something', 'Escalate: someone must decide');
    expect((await readBoxes(page)).map((box) => box.name)).toContain('Duplicate & ghost worker flagged: escalation');
    await expect(selectButton(panelOf(page), 'Escalate to')).toHaveText('Procurement');
    await expect(panelOf(page).getByRole('spinbutton', { name: 'Escalate after (hours)' })).toHaveValue('48');
    await openTest(page, 'Data engineer, trading data');
    await expectTestPanel(page, 'EN-043');
  });

  test('UI-A6 If → Otherwise rejects', async ({ page }) => {
    await openStep(page, 'Rate over card?');
    const otherwise = () => panelOf(page).getByRole('group', { name: 'Otherwise', exact: true });
    await selectButton(otherwise(), 'Then').click();
    expect(await optionTexts(page)).toEqual(['Carry on to "Value band"', 'Ask someone to approve', 'Escalate: someone must decide', 'Reject it and send it back to the requester', 'Stop the workflow and tell someone']);
    await page.getByRole('option', { name: 'Reject it and send it back to the requester' }).click();
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | rejected');
    expect(await boxText(page, 'Rejected')).toBe('Rejected | Rejected');
    await expect(canvasOf(page).getByRole('button', { name: 'Rejected', exact: true }).locator('svg')).toHaveCSS('color', 'rgb(251, 113, 133)');
    expect(await lineEndsAt(page, 'RA_C1', 'else')).toBe('Rejected');

    await openTest(page, 'Operations analyst');
    expect(await summaryOf(page)).toBe('1 approval round on this path. Rejected at "Rate over card?". It goes back to the requester with the reason; Levv tells Hiring manager.');
    const withRounds = (await readTestPanel(page)).cards.filter((entry) => entry.rounds.length > 0);
    expect(withRounds.map((entry) => entry.title)).toEqual(['Business sign-off']);
    expect(withRounds[0].rounds[0].startsWith('1 Hiring manager (Raj Patel)')).toBe(true);
    await expectTestPanel(page, 'EN-044');

    await openStep(page, 'Rate over card?');
    await choose(otherwise(), 'Then', 'Carry on to “Value band”');
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | carries on');
    await openTest(page, 'Operations analyst');
    await expectTestPanel(page, 'EN-017');
  });

  test('UI-A7 If → Otherwise escalates to a group', async ({ page }) => {
    await openStep(page, 'Rate over card?');
    const otherwise = () => panelOf(page).getByRole('group', { name: 'Otherwise', exact: true });
    await choose(otherwise(), 'Then', 'Escalate: someone must decide');
    await expect(selectButton(otherwise(), 'Escalate to')).toHaveText('Cost center owner');
    await expect(otherwise().getByText('They must act: approve (it carries on), reject with a comment, or send it back to the requester.')).toBeVisible();
    await expect(otherwise().getByRole('spinbutton', { name: 'Escalate after (hours)' })).toHaveValue('48');
    await choose(otherwise(), 'Escalate to', 'Finance controllers');
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | escalate · Finance controllers');
    expect(await boxText(page, 'Otherwise: escalation')).toBe('Otherwise: escalation | Finance controllers');
    expect(await lineEndsAt(page, 'RA_C1', 'else')).toBe('Otherwise: escalation');

    await openTest(page, 'Operations analyst');
    const escalation = await card(page, 'Otherwise: escalation');
    expect(escalation.status).toBe('Escalated');
    expect(escalation.rounds).toEqual(['1 Finance controllers (any one of Chloe Martin, Lena Fischer, David Okafor)']);
    expect(await summaryOf(page)).toBe('2 approval rounds on this path.');
    expect((await readTestPanel(page)).cards.map((entry) => entry.title)).not.toContain('Rate review');
    await expectTestPanel(page, 'EN-045');

    await openStep(page, 'Rate over card?');
    await choose(otherwise(), 'Then', 'Carry on to “Value band”');
    expect((await readBoxes(page)).map((box) => box.name)).not.toContain('Otherwise: escalation');
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | carries on');
  });

  test('UI-A8 If → a path asks someone to approve', async ({ page }) => {
    await openStep(page, 'Rate over card?');
    const otherwise = () => panelOf(page).getByRole('group', { name: 'Otherwise', exact: true });
    await choose(otherwise(), 'Then', 'Ask someone to approve');
    await expect(selectButton(otherwise(), 'Who approves')).toHaveText('Procurement');
    expect(norm((await otherwise().getByText(/^Then it carries on/).textContent()) ?? '')).toBe('Then it carries on to "Value band".');
    await choose(otherwise(), 'Who approves', 'Chloe Martin');
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | approval · Chloe Martin');
    expect(await boxText(page, 'Otherwise: approval')).toBe('! | Otherwise: approval | Chloe Martin · no backup');
    expect(await lineEndsAt(page, 'RA_C1', 'else')).toBe('Otherwise: approval');
    await expect.poll(() => novaCount(page)).toBe('1');
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([{ label: 'Check', message: '"Otherwise: approval" names Chloe Martin with no backup. If they\'re away, it pauses.', buttons: ['Show me'] }]);

    await openTest(page, 'Operations analyst');
    const approval = await card(page, 'Otherwise: approval');
    expect(approval.status).toBe('Approval');
    expect(approval.rounds).toEqual(['1 Chloe Martin']);
    const titles = (await readTestPanel(page)).cards.map((entry) => entry.title);
    expect(titles[titles.indexOf('Otherwise: approval') + 1]).toBe('Tell the supplier');
    expect((await card(page, 'Tell the supplier')).status).toBe('Sent');
    expect(titles).not.toContain('Rate review');
    await expectTestPanel(page, 'EN-046');

    await openStep(page, 'Rate over card?');
    await choose(otherwise(), 'Then', 'Carry on to “Value band”');
    expect(await boxText(page, 'Rate over card?')).toBe('Rate over card? | Over 10% | → Rate review | Otherwise | carries on');
    await expect.poll(() => novaCount(page)).toBe('0');
  });

  test('UI-A9 an approver only sometimes needed', async ({ page }) => {
    await openWorkflow(page, WO, 'Assignment changed');
    await expect(pickerButton(page, 'Assignment changed')).toBeVisible();
    expect(await boxText(page, 'Rate review')).toBe('Rate review | Procurement · only if Bill rate change (%) > 5%');
    await openTest(page, 'Data analyst extension and rate rise');
    expect(await readRows(page)).toEqual([
      ['Data analyst extension and rate rise', 'ASN-881 · Worked example 2, edit mid-approval'],
      ['Analyst rate change, two proposals', 'ASN-920 · Two pending changes'],
    ]);
    const panel = testPanelOf(page);
    await expect(panel.getByRole('button', { name: 'Try an edit: Manager shortens the extension to Mar 31' })).toBeVisible();
    expect(await summaryOf(page)).toBe('4 approval rounds on this path.');
    expect((await card(page, 'Tenure review')).rounds[0].startsWith('1 HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting')).toBe(true);
    expect((await card(page, 'Budget owner')).rounds[0].startsWith('1 Cost center owner (Lena Fischer): Approved')).toBe(true);
    expect((await card(page, 'Finance sign-off')).rounds[0].startsWith('1 VP Finance (David Okafor): Waiting')).toBe(true);
    expect((await card(page, 'Rate review')).rounds[0].startsWith('1 Procurement (Owen Clarke): Waiting')).toBe(true);
    await expectTestPanel(page, 'EN-006');

    await panel.getByRole('button', { name: 'Try an edit: Manager shortens the extension to Mar 31' }).click();
    await expectTestPanel(page, 'EN-063');
    await expect(panel.getByRole('button', { name: 'Undo the edit' })).toBeVisible();
    const view = await readTestPanel(page);
    expect(view.cards.map((entry) => entry.title)).not.toContain('Tenure review');
    expect(view.removed).toEqual(['HR business partner: approved, no longer needed', 'Legal: withdrawn, approver told']);
    expect((await card(page, 'Budget owner')).rounds[0].startsWith('1 Cost center owner (Lena Fischer): Stands')).toBe(true);
    // The block follows the step cards.
    const order = await panel.evaluate((root) => {
      const steps = root.querySelector('ul[aria-label="Steps"]') as Element;
      const removed = root.querySelector('section[aria-label="Removed by the edit"]') as Element;
      return steps.compareDocumentPosition(removed) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order).toBeTruthy();

    await panel.getByRole('button', { name: 'Undo the edit' }).click();
    await expectTestPanel(page, 'EN-006');
  });

  test('UI-A10 absence covered by a delegate', async ({ page }) => {
    await openWorkflow(page, WO, 'Assignment changed');
    await expect(pickerButton(page, 'Assignment changed')).toBeVisible();
    await openTest(page, 'Data analyst extension and rate rise');
    expect((await card(page, 'Tenure review')).rounds[0]).toBe('1 HR business partner (Erin Walsh): Approved, Legal (Luis Romero): Waiting · Hannah Brooks is out until Oct 24. Delegated to Luis Romero');
  });

  test('UI-A11 ineligible delegate → backup', async ({ page }) => {
    await goToUkAndTest(page, 'Senior cloud engineer');
    const [round] = (await card(page, 'Business sign-off')).rounds;
    expect(round).toContain("Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn't eligible for Information Security decisions, so Ravi Kumar (backup) approves");
    expect(round.split(' · ')[0]).toContain('Information Security (Ravi Kumar)');
  });

  test('UI-A12 split funding', async ({ page }) => {
    await openTest(page, 'Analytics lead, split funding');
    const [round] = (await card(page, 'Business sign-off')).rounds;
    expect(round).toBe('1 Hiring manager (Omar Haddad), Cost center owner (Lena Fischer), Cost center owner (Alicia Ng) · Omar Haddad is the hiring manager on the record (raised by Coordinator); Charged to Finance, so its cost center owner approves; Charged to Marketing, so its cost center owner approves');
    expect((await card(page, 'Rate review')).rounds).toEqual(['1 Procurement (Owen Clarke)']);
    expect((await card(page, 'Finance sign-off')).rounds).toEqual(['1 Finance business partner (Chloe Martin)']);
    await expectTestPanel(page, 'EN-020');
  });

  test('UI-A13 missing information', async ({ page }) => {
    await openTest(page, 'Ops contractor, no rate card yet');
    expect(await summaryOf(page)).toBe('1 approval round on this path. Needs information: Rate vs rate card (%) is missing, so "Rate over card?" can\'t decide. Procurement (Owen Clarke) has been asked to fill it in.');
    const view = await readTestPanel(page);
    expect(view.chips).toEqual(['Budget check → Passed', 'Duplicate & ghost worker → Passed', 'Rate over card? → Needs information']);
    expect(view.cards[view.cards.length - 1].title).toBe('Business sign-off');
    await expectTestPanel(page, 'EN-021');
  });

  test('UI-A14 running total; not asked again', async ({ page }) => {
    await openWorkflow(page, WO, 'SOW change order submitted');
    await expect(pickerButton(page, 'SOW change order submitted')).toBeVisible();
    await openTest(page, 'Document review: third top-up');
    expect((await readTestPanel(page)).notices).toContain('Comparing the running total of changes: $360K since the original $820K. This change alone is $60K');
    const procurement = await card(page, 'Procurement review');
    expect(procurement.status).toBe('Not asked again');
    expect(procurement.message).toBe('Procurement: approved the original; nothing they depend on changed');
    const finance = await card(page, 'Finance review');
    expect(finance.status).toBe('Approval');
    expect(finance.rounds).toEqual(['1 Finance business partner (Chloe Martin)']);
    expect((await readTestPanel(page)).chips).toEqual(['Scope changed? → No', 'Value band → Over $250K']);
    await expectTestPanel(page, 'EN-039');
  });

  test('UI-A15 approved automatically inside the plan', async ({ page }) => {
    await openWorkflow(page, WO, 'Job posting created');
    await expect(pickerButton(page, 'Job posting created')).toBeVisible();
    await openTest(page, 'Junior data analyst, 6 months (job posting)');
    expect(await summaryOf(page)).toBe('No one needs to approve on this path. Approved automatically. No one had to act.');
    expect(await card(page, 'Approve within plan')).toMatchObject({ status: 'Approved automatically', message: 'Approved automatically: fits the approved plan' });
    expect(await card(page, 'Send to suppliers')).toMatchObject({ status: 'Sent', message: 'Email to Procurement (Owen Clarke)' });
    await expectTestPanel(page, 'EN-036');
  });

  test('UI-A16 approved automatically on matching hours', async ({ page }) => {
    await openWorkflow(page, WO, 'Timesheet submitted');
    await expect(pickerButton(page, 'Timesheet submitted')).toBeVisible();
    await openTest(page, 'Timesheet, week of Oct 12');
    expect(await card(page, 'Approve scheduled hours')).toMatchObject({ status: 'Approved automatically', message: 'Approved automatically: hours match the schedule and work order' });
    expect(await card(page, 'Tell the supplier it can invoice')).toMatchObject({ status: 'Sent', message: 'Email to Supplier account manager' });
    await expectTestPanel(page, 'EN-040');
  });

  test('UI-A17 two changes at once', async ({ page }) => {
    await openWorkflow(page, WO, 'Assignment changed');
    await expect(pickerButton(page, 'Assignment changed')).toBeVisible();
    await openTest(page, 'Analyst rate change, two proposals');
    const panel = testPanelOf(page);
    const view = await readTestPanel(page);
    expect(view.summary).toBe('Nothing is approved yet: approvals wait until one of the two proposed changes is chosen.');
    expect(view.conflict).toEqual({
      badge: 'Conflict',
      message: 'Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. Nothing is overwritten; approvals wait until one version is chosen.',
      choices: ['Use $96/h', 'Use $102/h'],
    });
    expect(await card(page, 'Rate review')).toMatchObject({ status: 'Not needed', message: 'Only needed when Bill rate change (%) > 5%' });
    await expectTestPanel(page, 'EN-007');

    await panel.getByRole('button', { name: 'Use $96/h' }).click();
    await expectTestPanel(page, 'EN-061');
    expect((await readTestPanel(page)).notices).toContain('Using $96/h from Grace Kim. Raj Patel has been told, and approval links for the other version no longer work.');
    await panel.getByRole('button', { name: 'Undo', exact: true }).click();
    await expectTestPanel(page, 'EN-007');
    await panel.getByRole('button', { name: 'Use $102/h' }).click();
    await expectTestPanel(page, 'EN-062');
    await panel.getByRole('button', { name: 'Undo', exact: true }).click();
    await expectTestPanel(page, 'EN-007');
  });

  test('UI-A18 Nova writes a condition from plain words', async ({ page }) => {
    await openStep(page, 'Rate review');
    const panel = panelOf(page);
    await openDetails(panel);
    expect(norm((await panel.getByText(/^Leave empty and this approver/).textContent()) ?? '')).toBe("Leave empty and this approver is always asked. Tell Nova when they're needed, in your own words.");
    const input = panel.getByRole('textbox', { name: 'Only needed when' });
    await expect(input).toHaveAttribute('placeholder', 'e.g. the bill rate goes up more than 5%, or the work country is UK');
    await input.fill('rate is more than 15% over the rate card');
    await panel.getByRole('button', { name: '✦ Set' }).click();
    await expect(panel.getByText('Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test.')).toBeVisible();
    await expect(selectButton(panel, 'Asked only if')).toHaveText('all of these');
    await expect(selectButton(panel, 'Field')).toHaveText('Rate vs rate card (%)');
    await expect(selectButton(panel, 'Comparison')).toHaveText('>');
    await expect(panel.getByRole('spinbutton', { name: 'Value' })).toHaveValue('15');
    await expect(panel.getByRole('button', { name: 'Remove rule' })).toBeVisible();
    for (const name of ['+ Add a condition', '+ Add an either/or condition', 'Always ask this approver']) await expect(panel.getByRole('button', { name })).toBeVisible();
    expect(await boxText(page, 'Rate review')).toBe('Rate review | Procurement · only if Rate vs rate card (%) > 15%');

    await openTest(page, 'Senior cloud engineer');
    expect(await card(page, 'Rate review')).toMatchObject({ status: 'Not needed', message: 'Only needed when Rate vs rate card (%) > 15%' });
    await expectTestPanel(page, 'EN-052');

    await openStep(page, 'Rate review');
    await openDetails(panelOf(page));
    await panelOf(page).getByRole('button', { name: 'Always ask this approver' }).click();
    await expect(selectButton(panelOf(page), 'Field')).toHaveCount(0);
    expect(await boxText(page, 'Rate review')).toBe('Rate review | Procurement');
  });

  test('UI-A19 a named person without a backup is flagged', async ({ page }) => {
    await openStep(page, 'Rate review');
    const panel = panelOf(page);
    await choose(panel, 'Who approves', 'A named person');
    const person = selectButton(panel, 'Person');
    await expect(person).toHaveText('Choose a person');
    await expect(selectButton(panel, 'Backup when they’re away')).toHaveText('No backup');
    expect(norm((await panel.getByText(/^A named person doesn/).textContent()) ?? '')).toBe("A named person doesn't follow reorgs. If they leave or change role, Nova flags every step that names them.");
    expect(await boxText(page, 'Rate review')).toBe('! | Rate review | Choose who approves');
    await expect.poll(() => novaCount(page)).toBe('1');

    await person.click();
    const people = await optionTexts(page);
    expect(people).toHaveLength(31);
    expect(people).toContain('Alan Brooks · Head of Technology UK');
    expect(people).toContain('Chloe Martin');
    await page.getByRole('option', { name: 'Chloe Martin', exact: true }).click();
    expect(await boxText(page, 'Rate review')).toBe('! | Rate review | Chloe Martin · no backup');
    await expect(page.getByRole('banner').getByText('Live v1 · unpublished changes')).toBeVisible();
    await expect.poll(() => novaCount(page)).toBe('1');

    await novaButton(page).click();
    const nova = novaPanelOf(page);
    await expect(nova.getByRole('heading', { name: 'Nova', exact: true })).toBeVisible();
    await expect(nova.getByText('Checks and suggestions', { exact: true })).toBeVisible();
    await expect(nova.getByText('Nova checked this flow against 140 real records from the last 90 days.')).toBeVisible();
    expect(await readNova(page)).toEqual([{ label: 'Check', message: '"Rate review" names Chloe Martin with no backup. If they\'re away, it pauses.', buttons: ['Show me'] }]);
    await nova.getByRole('button', { name: 'Show me' }).click();
    await expect(panelOf(page).getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
    await expect(panelOf(page).getByText('Rate review', { exact: true }).first()).toBeVisible();
    await expect(page).toHaveURL(/[?&]step=RA_A2/);
  });
});

test.describe('B.4 workflows, the Test half', () => {
  test('UI-W1 standard onboarding', async ({ page }) => {
    await openWorkflow(page, WO, 'Contractor onboarding');
    await expect(pickerButton(page, 'Contractor onboarding')).toBeVisible();
    await openTest(page, 'Senior cloud engineer');
    expect(await readRows(page)).toEqual([
      ['Senior cloud engineer', 'WO-2214-A · Onboarding, standard'],
      ['Data engineer, trading data', 'WO-2240-A · Onboarding, regulated role'],
      ['Analyst, checks need attention', 'WO-2251-A · ID unclear, background adverse'],
    ]);
    const view = await readTestPanel(page);
    expect(view.summary).toBeNull();
    expect(view.chips).toContain('Registration required? → No');
    expect(await card(page, 'Vendor insurance')).toMatchObject({ status: 'Review: Procurement', message: 'Asked of Supplier account manager: Certificate of insurance. Waiting for Procurement (Owen Clarke)' });
    expect(await card(page, 'Laptop and badge')).toMatchObject({ status: 'Review: IT service desk', message: 'Asked of IT service desk (Sam Patel): Laptop, Building badge. Waiting for IT service desk (Sam Patel)' });
    const legal = await card(page, 'Legal & compliance');
    expect(legal.status).toBe('Verified automatically');
    expect(legal.message).toMatch(/Verified by E-signature$/);
    expect((await card(page, 'Workday provisioning')).status).toBe('Done in Workday');
    const seed = (await (await page.request.get('/api/flow-studio/workflows/wf-onboard')).json()) as { workflow: { draft: { nodes: Record<string, { kind: string; label: string }> } } };
    const collects = Object.values(seed.workflow.draft.nodes).filter((node) => node.kind === 'collect').map((node) => node.label);
    for (const entry of view.cards) if (collects.includes(entry.title)) expect(entry.workerSees, entry.title).toMatch(/^Worker sees: /);
    await expectTestPanel(page, 'EN-001');
  });

  test('UI-W2 onboarding when checks go wrong', async ({ page }) => {
    await openWorkflow(page, WO, 'Contractor onboarding');
    await expect(pickerButton(page, 'Contractor onboarding')).toBeVisible();
    await openTest(page, 'Analyst, checks need attention');
    expect(await card(page, 'Identity & eligibility')).toMatchObject({ status: 'Unsure: People Ops', message: "Asked of the worker: Photo ID, Right to work. Persona wasn't sure, so People Ops (Jordan Lee) reviews" });
    expect(await card(page, 'Background check')).toMatchObject({
      status: 'Failed: decision needed',
      message: 'Asked of the worker: Criminal record, Employment history. Failed. HR business partner and Legal must decide whether to carry on',
      rounds: ['1 HR business partner (Erin Walsh), Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero'],
    });
    expect(await card(page, 'System access')).toMatchObject({ status: 'Waiting', message: 'Waiting on Background check' });
    expect((await card(page, 'Wait for start date')).status).toBe('Waiting');
    expect((await card(page, 'Payroll & banking')).status).toBe('Waiting');
    await expectTestPanel(page, 'EN-003');
  });

  test('UI-W3 offboarding', async ({ page }) => {
    await openWorkflow(page, WO, 'Contractor offboarding');
    await expect(pickerButton(page, 'Contractor offboarding')).toBeVisible();
    await openTest(page, 'Cloud engineer, not extended');
    expect(await readRows(page)).toEqual([
      ['Cloud engineer, not extended', 'OFF-902 ·'],
      ['Data analyst, ended early (ended early)', 'OFF-915 · Ended early'],
    ]);
    expect(await card(page, 'Knowledge handover')).toMatchObject({ status: 'To do: Hiring manager', message: 'Confirm handover is done: Hiring manager (Tom Reed)' });
    expect((await card(page, 'Final timesheet & expenses')).status).toBe('Review: Hiring manager');
    expect((await card(page, 'Return equipment')).status).toBe('To do: IT service desk');
    expect((await card(page, 'Exit confirmations')).status).toBe('Verified automatically');
    expect((await readTestPanel(page)).cards.filter((entry) => entry.status === 'Waiting')).toHaveLength(5);
    await expectTestPanel(page, 'EN-008');
  });

  test('UI-W4 extend or end', async ({ page }) => {
    await openWorkflow(page, WO, 'Assignment ending');
    await expect(pickerButton(page, 'Assignment ending')).toBeVisible();
    await openTest(page, 'Designer, manager extends');
    await expectTestPanel(page, 'EN-005');
    expect(await card(page, 'Extend or end?')).toMatchObject({ status: 'Done', message: 'Decide whether to extend: done by Hiring manager (Sofia Reyes)' });
    expect(await card(page, 'Tenure & classification')).toMatchObject({ status: 'Passed', message: '12 months engaged after this change (cap 18)' });
    expect((await card(page, 'Within plan?')).status).toBe('Inside the plan');
    expect(await card(page, 'Auto-approve if no one else needed')).toMatchObject({ status: 'Approved automatically', message: 'Approved automatically: inside plan, no threshold crossed' });

    await openTest(page, 'Cloud engineer, ending Nov 16');
    await expectTestPanel(page, 'EN-004');
    expect((await readTestPanel(page)).chips).toContain('Extending? → No');
    expect(await card(page, 'Confirm the end date')).toMatchObject({ status: 'Sent', message: 'Email to Hiring manager (Tom Reed), Supplier account manager' });
  });

  test('UI-W5 invoice exception and straight-through', async ({ page }) => {
    await openWorkflow(page, WO, 'Invoice received');
    await expect(pickerButton(page, 'Invoice received')).toBeVisible();
    await openTest(page, 'Invoice doesn’t match timesheets');
    await expectTestPanel(page, 'EN-013');
    expect(await card(page, 'Resolve exception')).toMatchObject({ status: 'To do: Accounts payable', message: 'Resolve the invoice exception with the supplier: Accounts payable (Nina Shah)' });
    await openTest(page, 'Invoice matches');
    await expectTestPanel(page, 'EN-014');
    expect(await card(page, 'Release for payment')).toMatchObject({ status: 'Done in SAP S/4HANA', message: 'Update supplier invoice in SAP S/4HANA, matched on Work order ID, 2 fields sent; reads back Posting status; waits up to 24h for SAP S/4HANA to confirm' });
  });

  test('UI-W6 document renewal', async ({ page }) => {
    await openWorkflow(page, WO, 'Document renewal');
    await expect(pickerButton(page, 'Document renewal')).toBeVisible();
    await openTest(page, 'Forklift certificate expiring');
    const view = await readTestPanel(page);
    expect(view.cards).toHaveLength(1);
    expect(view.cards[0]).toMatchObject({ title: 'Renewed document', status: 'Verified automatically', message: 'Asked of the worker: Updated certificate. Verified by Document collector', workerSees: 'Worker sees: Done' });
    await expectTestPanel(page, 'EN-012');
  });

  test('UI-W7 a change has its own approvals', async ({ page }) => {
    await openWorkflow(page, WO, 'Work order changed');
    await expect(pickerButton(page, 'Work order changed')).toBeVisible();
    const boxes = (await readBoxes(page)).map((box) => norm(box.text)).sort();
    expect(boxes).toEqual([
      'Work order changed | Everywhere',
      'Tell the supplier | Supplier account manager',
      'End | Completed',
      'Business sign-off | Together: Hiring manager + Cost center owner',
      'Rate over card? | Over 10% | → Rate review | Otherwise | carries on',
      'Rate review | Procurement',
      'Value band | Over $1M | → Executive sign-off | Over $250K | → Finance sign-off | Otherwise | carries on',
      'Finance sign-off | Finance business partner',
      'Executive sign-off | In order: VP Finance + CFO',
      'Flagged | Passed | Budget check | If flagged: approvers see it',
      'Flagged | Passed | Duplicate & ghost worker | If flagged: escalate to Procurement',
      'Duplicate found: escalation | Procurement',
    ].sort());
    await openTest(page, 'Senior cloud engineer — rate change');
    expect(await summaryOf(page)).toBe('1 approval round on this path.');
    expect((await card(page, 'Business sign-off')).rounds).toEqual(['1 Hiring manager (Tom Reed), Cost center owner (Alan Brooks) · Priya Shah raised this request, so the step moves up to Alan Brooks (Head of Technology UK)']);
    expect((await card(page, 'Tell the supplier')).status).toBe('Sent');
    await expectTestPanel(page, 'EN-041');
  });

  test('UI-W8 access request, clean', async ({ page }) => {
    await openWorkflow(page, WO, 'Site access request');
    await expect(pickerButton(page, 'Site access request')).toBeVisible();
    expect(await boxText(page, 'Access request submitted in Zip')).toBe('Access request submitted in Zip | Everywhere');
    await openTest(page, 'Visiting engineer, 2 weeks on site');
    expect(await card(page, 'Duplicate & ghost worker')).toMatchObject({ status: 'Passed', message: 'No active badge or open request for this person' });
    const security = await card(page, 'Security approves access');
    expect(security.status).toBe('Approval');
    expect(security.rounds[0]).toMatch(/^1 Information Security \(Ravi Kumar\) · Kenji Watanabe is out until Oct 30/);
    expect((await card(page, 'Identity & site details')).message).toBe('Asked of Worker (Jordan Ellis): Photo ID, Date of birth, Signed site safety rules. Verified by Persona');
    expect((await card(page, 'Issue the badge')).status).toBe('Done in Badge system');
    expect((await card(page, 'Badge ready')).message).toBe('Email to Worker (Jordan Ellis), Sponsor (Grace Kim, or their delegate Raj Patel)');
    await expectTestPanel(page, 'EN-010');
  });

  test('UI-W9 access request, already badged', async ({ page }) => {
    await openWorkflow(page, WO, 'Site access request');
    await expect(pickerButton(page, 'Site access request')).toBeVisible();
    await openTest(page, 'Returning vendor technician');
    expect(await card(page, 'Duplicate & ghost worker')).toMatchObject({ status: 'Flagged', message: 'This person already has an active badge from an earlier request' });
    const escalated = await card(page, 'Duplicate & ghost worker flagged: escalation');
    expect(escalated.status).toBe('Escalated');
    expect(escalated.rounds[0]).toMatch(/^1 Information Security \(Ravi Kumar\)/);
    expect(await card(page, 'Security approves access')).toMatchObject({ status: 'Covered', message: 'The same person already approves this kind of decision on this path' });
    await expectTestPanel(page, 'EN-011');
  });
});
