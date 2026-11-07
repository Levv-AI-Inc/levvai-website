'use client';

import { useState } from 'react';
import { copy } from '@flow-studio/engine/copy';
import { dispOf } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { CollectNode, SystemNode, TaskNode } from '@flow-studio/model/workflow';
import { uiCopy } from '../copy';
import { actorRoleOptions, withCurrent } from '../options';
import { GroupBox, SayBox, ToggleRow } from '../ui/primitives';
import { entries, SelectField, TextField, TwoColumns } from './fields';

/** 04 §6.4. On while it has text, or from the switch until the text is typed. */
export function GivesBlock({ node, ctx, onFields }: { node: CollectNode | SystemNode | TaskNode; ctx: EngineContext; onFields: (fields: Record<string, unknown>) => void }) {
  const [switchedOn, setSwitchedOn] = useState(false);
  const on = switchedOn || !!node.gives;
  const actors = actorRoleOptions(ctx);
  const doneBy = node.reverseBy ?? 'hm';
  const reverseWhen = (node as CollectNode).reverseWhen ?? 'after';
  return (
    <GroupBox>
      <ToggleRow
        label={uiCopy.givesSwitch}
        help={uiCopy.givesSmall}
        on={on}
        onToggle={(next) => {
          setSwitchedOn(next);
          if (!next) onFields({ gives: '', reverse: '' });
        }}
      />
      {on ? (
        <>
          <TextField label={uiCopy.givesWhat} value={node.gives ?? ''} placeholder={uiCopy.givesWhatPlaceholder} onChange={(gives) => onFields({ gives })} />
          <TwoColumns>
            <SelectField label={uiCopy.givesAtExit} options={entries(copy.DISP)} value={dispOf(node)} onChange={(disp) => onFields({ disp })} />
            <SelectField
              label={uiCopy.givesWhen}
              options={[
                { value: 'before', label: uiCopy.givesBefore },
                { value: 'after', label: uiCopy.givesOnDay },
              ]}
              value={reverseWhen}
              onChange={(value) => onFields({ reverseWhen: value })}
            />
          </TwoColumns>
          <TwoColumns>
            <TextField label={uiCopy.givesExitStep} value={node.reverse ?? ''} placeholder={uiCopy.givesExitPlaceholder} onChange={(reverse) => onFields({ reverse })} />
            {node.kind === 'system' ? (
              <SayBox>{uiCopy.givesSystem(node.system)}</SayBox>
            ) : (
              <SelectField label={uiCopy.givesDoneBy} options={withCurrent(actors, [doneBy], ctx)} value={doneBy} onChange={(reverseBy) => onFields({ reverseBy })} />
            )}
          </TwoColumns>
        </>
      ) : null}
    </GroupBox>
  );
}
