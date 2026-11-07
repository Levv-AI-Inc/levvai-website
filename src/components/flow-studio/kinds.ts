import {
  AlarmClock,
  Bell,
  Calendar,
  ChartLine,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  FileCheck,
  GitBranch,
  KeyRound,
  MessageSquare,
  PenLine,
  Play,
  Plug,
  Receipt,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Split,
  Trash2,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { StepKind } from '@flow-studio/model/catalog';
import type { WfNode } from '@flow-studio/model/workflow';

/** 04 §1.4 and §1.5. */
export const KIND_STYLE: Record<StepKind, { icon: LucideIcon; color: string }> = {
  trigger: { icon: Zap, color: 'text-orange-400' },
  cond: { icon: Split, color: 'text-green-400' },
  plan: { icon: Wallet, color: 'text-green-400' },
  policy: { icon: ShieldCheck, color: 'text-emerald-400' },
  appr: { icon: UserCheck, color: 'text-cyan-400' },
  notify: { icon: Bell, color: 'text-slate-300' },
  task: { icon: PenLine, color: 'text-fuchsia-300' },
  collect: { icon: ClipboardCheck, color: 'text-pink-300' },
  system: { icon: Plug, color: 'text-blue-400' },
  parallel: { icon: GitBranch, color: 'text-blue-400' },
  runwf: { icon: Play, color: 'text-blue-400' },
  wait: { icon: Clock, color: 'text-amber-400' },
  end: { icon: CircleCheck, color: 'text-emerald-400' },
  dw: { icon: Sparkles, color: 'text-violet-200' },
};

/** 04 §1.4. 02 §8 also gives each worker an SVG path; lucide wins (notes). */
export const DW_ICONS: Record<string, LucideIcon> = {
  rate: ChartLine,
  budget: Wallet,
  dup: Users,
  tenure: Calendar,
  intake: MessageSquare,
  invoice: Receipt,
  docs: FileCheck,
  access: KeyRound,
  startguard: AlarmClock,
  sweeper: Trash2,
  recovery: Truck,
  closer: ReceiptText,
};

export function iconOf(node: WfNode): { icon: LucideIcon; color: string } {
  if (node.kind === 'end' && node.outcome === 'rejected') return { icon: CircleX, color: 'text-rose-400' };
  if (node.kind === 'dw') return { icon: DW_ICONS[node.worker] ?? Sparkles, color: KIND_STYLE.dw.color };
  return KIND_STYLE[node.kind];
}
