import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn({ permission: 'flow.edit' }, async ({ store }) => {
  const { catalog, people, rules, dws, presets, systems } = await store.reference.getAll();
  return json({ catalog, people, rules, digitalWorkers: dws, presets, systems });
});
