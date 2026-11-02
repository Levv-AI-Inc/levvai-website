export const SEED_OVERRIDE_FLAG = 'FLOW_STUDIO_SEED_ALLOW_REMOTE';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

const allowed = (env: Record<string, string | undefined>): boolean => env[SEED_OVERRIDE_FLAG] === '1';

/** Decision 3: the seed talks to a URL, and refuses anything but this machine unless told otherwise. */
export function refusalForBackend(url: string, env: Record<string, string | undefined>): string | null {
  if (allowed(env)) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return `Not a URL: ${url}`;
  }
  if (LOCAL_HOSTS.includes(hostname)) return null;
  return `Refusing to seed ${hostname}: it is not this machine. Set ${SEED_OVERRIDE_FLAG}=1 only if you mean it.`;
}

/** A local Django can still point at a hosted database, so the backend is asked too. */
export function refusalForDatabase(target: { databaseIsLocal: boolean }, env: Record<string, string | undefined>): string | null {
  if (allowed(env) || target.databaseIsLocal) return null;
  return `Refusing to seed: this backend's database is not on this machine. Set ${SEED_OVERRIDE_FLAG}=1 only if you mean it.`;
}
