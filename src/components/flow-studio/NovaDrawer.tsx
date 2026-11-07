'use client';

import { Sparkles } from 'lucide-react';
import { copy, curl } from '@flow-studio/engine/copy';
import { novaHeader } from '@flow-studio/engine/lint';
import type { Issue, LintResult, Severity } from '@flow-studio/model/results';
import { uiCopy } from './copy';
import { Drawer } from './Drawer';
import { Badge, type BadgeVariant } from './ui/primitives';

const VARIANT: Record<Severity, BadgeVariant> = { bad: 'error', warn: 'warning', tip: 'info', info: 'neutral' };

const darkButton = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400';
const secondary = `${darkButton} border-slate-700 bg-slate-900 text-slate-100 hover:border-cyan-400`;
const primary = `${darkButton} border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700`;

interface NovaDrawerProps {
  lint: LintResult;
  compact: boolean;
  onClose: () => void;
  onShow: (nodeId: string) => void;
  onFix: (issue: Issue) => void;
  onChooseWinner: (opener: HTMLElement) => void;
}

/** 04 §9. Everything here is computed on the client from the current draft, so it follows every edit. */
export function NovaDrawer({ lint, compact, onClose, onShow, onFix, onChooseWinner }: NovaDrawerProps) {
  return (
    <Drawer title={uiCopy.nova} subtitle={uiCopy.novaSubtitle} compact={compact} dark onClose={onClose} icon={<Sparkles aria-hidden className="h-[18px] w-[18px] text-cyan-400" />}>
      <div className="rounded-[10px] bg-slate-900 px-3 py-2.5 text-[13px] leading-relaxed text-slate-100">{novaHeader(lint.recs)}</div>
      {lint.issues.length === 0 ? (
        <div className="rounded-[10px] border border-emerald-500/40 bg-emerald-950/40 px-3 py-2.5 text-[13px] text-emerald-300">
          <strong className="font-semibold">{copy.looksGood}</strong>
          <br />
          {copy.nothingToFix}
        </div>
      ) : (
        <ul aria-label={uiCopy.novaIssues} className="flex flex-col gap-2">
          {lint.issues.map((issue, index) => {
            const label = copy.severityLabel[issue.sev];
            return (
              <li key={`${index}:${issue.m}`} className="flex flex-col gap-2 rounded-[10px] border border-slate-800 bg-slate-900 p-3 text-[13px]">
                <p>
                  {label ? <Badge variant={VARIANT[issue.sev]} className="mr-1.5">{label}</Badge> : null}{' '}
                  <span>{curl(issue.m)}</span>
                </p>
                {issue.fix || issue.node || issue.overlap ? (
                  <div className="flex flex-wrap gap-2">
                    {issue.fix && issue.fl ? (
                      <button type="button" className={primary} onClick={() => onFix(issue)}>
                        {copy.fixButton(issue.fl)}
                      </button>
                    ) : null}
                    {issue.node ? (
                      <button type="button" className={secondary} onClick={() => onShow(issue.node as string)}>
                        {copy.showMe}
                      </button>
                    ) : null}
                    {issue.overlap ? (
                      <button type="button" className={secondary} onClick={(event) => onChooseWinner(event.currentTarget)}>
                        {copy.chooseWhichWins}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
