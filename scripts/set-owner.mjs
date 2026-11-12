// Creates the owner account, or resets the owner's password. Run it on the server, in the app folder:
//   node set-owner.mjs                       create the owner or set a new password
//   node set-owner.mjs --remove-two-factor   same, and also turn two-factor off (lost phone)
// It asks for the database address (or reads DATABASE_URL), the email, name and password.
import { randomBytes, scrypt } from 'node:crypto'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { error as logError, log } from 'node:console'

// Must match src/lib/auth/password.ts; a test checks the two agree.
export function hashPassword(password) {
  const salt = randomBytes(16)
  return new Promise((done, fail) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
    error ? fail(error) : done(['scrypt', 16384, 8, 1, salt.toString('base64'), key.toString('base64')].join('$'))))
}

// One reader for every question, so answers typed (or pasted) ahead are not lost between questions.
let lines
let hiding = false
let piped
async function ask(question, hidden = false) {
  // Answers piped in (not typed) are read all at once and handed out in order.
  if (!process.stdin.isTTY) {
    piped ??= await new Promise((done) => { let text = ''; process.stdin.on('data', (chunk) => { text += chunk }); process.stdin.on('end', () => done(text.split(/\r?\n/))) })
    process.stdout.write(`${question}\n`)
    return (piped.shift() ?? '').trim()
  }
  lines ??= createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  // Passwords show as * while typed.
  lines._writeToOutput = (text) => { if (!hiding || text.startsWith(question)) process.stdout.write(text); else if (!text.includes('\n')) process.stdout.write('*') }
  hiding = hidden
  return new Promise((done) => lines.question(question, (answer) => { if (hidden) process.stdout.write('\n'); hiding = false; done(answer.trim()) }))
}

async function main() {
  const { default: pg } = await import('pg')
  const connectionString = process.env.DATABASE_URL || await ask('Database address (DATABASE_URL): ', true)
  const email = (await ask('Owner email: ')).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That email does not look right.')
  const name = await ask('Owner full name: ')
  const password = await ask('New password (12+ characters): ', true)
  if (password.length < 12) throw new Error('Use a password of at least 12 characters.')
  if (password !== await ask('Type it again: ', true)) throw new Error('The two passwords do not match.')
  lines?.close()

  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    const { rows: [ready] } = await client.query("select to_regclass('public.profiles') as table")
    if (!ready?.table) throw new Error('The shop database is not set up yet. Open https://siaabmobile.com/api/health once, then run this again.')
    const hash = await hashPassword(password)
    const clearTwoFactor = process.argv.includes('--remove-two-factor')
    const { rows } = await client.query(
      `insert into public.profiles(email, full_name, password_hash, role) values ($1, $2, $3, 'owner')
       on conflict (email) do update set full_name = coalesce(nullif($2, ''), public.profiles.full_name), password_hash = $3, role = 'owner', disabled_at = null
         ${clearTwoFactor ? ', totp_secret = null, totp_pending = null' : ''}
       returning id, (xmax = 0) as created`,
      [email, name, hash],
    )
    await client.query('delete from public.sessions where profile_id = $1', [rows[0].id])
    log(rows[0].created ? `Owner account created for ${email}. Sign in at /admin/login.` : `Password updated for ${email}. Old sign-ins were ended.${clearTwoFactor ? ' Two-factor is off.' : ''}`)
  } finally {
    await client.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { logError(error instanceof Error ? error.message : error); process.exit(1) })
}
