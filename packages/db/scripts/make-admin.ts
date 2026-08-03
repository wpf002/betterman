/**
 * Grants (or revokes) admin.
 *
 *   pnpm db:make-admin will@example.com
 *   pnpm db:make-admin will@example.com --revoke
 *
 * Deliberately a command-line action: there is no path to admin through the
 * app itself, so a reader cannot promote themselves.
 */
import { UserRole, prisma } from '../src/index.js';

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes('--revoke');

async function main() {
  if (!email) {
    console.error('usage: pnpm db:make-admin <email> [--revoke]');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error(`No account for ${email}. They need to sign up first.`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: revoke ? UserRole.READER : UserRole.ADMIN },
  });

  console.log(`${email} is now ${revoke ? 'a reader' : 'an admin'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
