import type { EngineContext } from '../model/context';
import type { CheckResult } from '../model/results';
import { copy } from './copy';
import type { Rec } from './conditions';
import { fmt } from './text';

type DwCtx = Pick<EngineContext, 'dws'>;

/** Rate-card limit and tenure cap (engine §5). Production reads them from policy, defaulting to these. */
const RATE_CARD_LIMIT = 10;
const TENURE_CAP = 18;

export const isCheck = (worker: string, ctx: DwCtx): boolean => ctx.dws.CHECK_DW.includes(worker);

/** Engine §5. Digital Workers never approve or reject: a check only takes its Passed or Flagged exit. */
export function checkResult(worker: string, rec: Rec, ctx: DwCtx): { ok: boolean; m: string } {
  switch (worker) {
    case 'rate': {
      const card = rec.rate_vs_card_pct as number | null | undefined;
      if (card == null) return { ok: true, m: copy.rateNoRate };
      return { ok: card <= RATE_CARD_LIMIT, m: copy.rateResult(card, rec.rate_vs_market_pct as number) };
    }
    case 'budget': {
      const left = rec.budget_left_after as number | null | undefined;
      if (left == null) return { ok: true, m: copy.budgetNoData };
      return left >= 0 ? { ok: true, m: copy.budgetLeft(fmt(left)) } : { ok: false, m: copy.budgetOver(fmt(-left)) };
    }
    case 'dup':
      if (rec.record === 'access_request') {
        return rec.duplicate_found ? { ok: false, m: copy.dupAccessFound } : { ok: true, m: copy.dupAccessClear };
      }
      return rec.duplicate_found ? { ok: false, m: copy.dupFound } : { ok: true, m: copy.dupClear };
    case 'tenure': {
      const months = rec.months_engaged_after as number | null | undefined;
      if (months == null) return { ok: true, m: copy.tenureNoData };
      return { ok: months <= TENURE_CAP, m: copy.tenureResult(months) };
    }
    default:
      return { ok: true, m: copy.workerCompleted(ctx.dws.DW[worker]?.n ?? worker) };
  }
}

/** Engine §5: helpers always succeed in Test. */
export const helperMessage = (worker: string, ctx: DwCtx): string => ctx.dws.DWX[worker]?.d ?? ctx.dws.DWD[worker] ?? '';

export const checkEntry = (worker: string, rec: Rec, ctx: DwCtx): CheckResult => ({ d: worker, ...checkResult(worker, rec, ctx) });
