import { z } from 'zod';
import { memoryDriver } from '@flow-studio/data/memory/store';
import type { SeedPeople } from '@flow-studio/model/schemas';
import { E2E_COOKIE, e2eState, signE2ESession } from '@flow-studio/server/e2e';
import { notFound } from '@flow-studio/server/errors';
import { noContent, readBody } from '@flow-studio/server/route';
import { testOnly } from '@flow-studio/server/test-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SignIn = z.object({ user: z.string() });

export const POST = testOnly(async (request) => {
  const { user } = await readBody(request, SignIn);
  const driver = await memoryDriver();
  const people = (await driver.get('reference', 'people-and-authority'))?.doc as SeedPeople | undefined;
  const listed = e2eState().actors?.users.some((actor) => actor.name === user);
  if (!listed && !people?.PEOPLE.includes(user)) throw notFound('Nobody has that name.');
  const response = noContent();
  response.cookies.set(E2E_COOKIE, signE2ESession(user), { httpOnly: true, sameSite: 'lax', path: '/' });
  return response;
});
