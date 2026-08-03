import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * Password hashing with scrypt from Node's own crypto — memory-hard, no
 * dependency, and the parameters travel with the hash so they can be raised
 * later without invalidating existing accounts.
 *
 * Stored form: `scrypt$N$r$p$<salt hex>$<key hex>`
 */
/**
 * `promisify` collapses scrypt's overloads and loses the options argument, so
 * the promise wrapper is written out rather than derived.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

/** OWASP's floor for scrypt at time of writing. */
const N = 2 ** 16;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r,
    p,
    // scrypt needs roughly 128 * N * r bytes; Node's default cap is lower.
    maxmem: 256 * N * r,
  });

  return ['scrypt', N, r, p, salt.toString('hex'), key.toString('hex')].join('$');
}

/**
 * Constant-time verification. Returns false rather than throwing on a
 * malformed hash, so a corrupt row cannot become a 500 on the sign-in path.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nRaw, rRaw, pRaw, saltHex, keyHex] = stored.split('$');
    if (scheme !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltHex || !keyHex) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const params = { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) };

    const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      ...params,
      maxmem: 256 * params.N * params.r,
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
