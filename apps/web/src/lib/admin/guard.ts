import 'server-only';
import { notFound } from 'next/navigation';
import { UserRole, prisma } from '@betterman/db';
import { getSessionUser } from '../auth/session';

/**
 * Admin access.
 *
 * A non-admin gets a 404 rather than a 403: the admin surfaces are not
 * something a reader should learn exist, and "forbidden" confirms they do.
 * Role is read fresh from the database rather than trusted from the session,
 * so revoking admin takes effect on the next request instead of whenever the
 * session happens to expire.
 */
export async function requireAdmin() {
  const session = await getSessionUser();
  if (!session) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, role: true },
  });

  if (!user || user.role !== UserRole.ADMIN) notFound();
  return user;
}

/** For server actions, which must fail rather than render a 404. */
export async function assertAdmin(): Promise<string | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true },
  });

  return user?.role === UserRole.ADMIN ? user.id : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await assertAdmin()) !== null;
}
