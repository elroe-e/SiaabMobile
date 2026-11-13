// Builds the site as a self-contained Node server and zips it for upload to cPanel "Setup Node.js App".
// Secrets (DATABASE_URL, GEMINI_API_KEY) are not baked in; they live in the cPanel app's environment variables.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { error as logError, log } from 'node:console'

const env = { ...process.env, NEXT_OUTPUT: 'standalone', NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://siaabmobile.com' }
execFileSync('npx next build', { stdio: 'inherit', shell: true, env })

const app = join('.next', 'standalone')
// The standalone server does not include the browser files; they have to sit next to it.
cpSync('public', join(app, 'public'), { recursive: true })
cpSync(join('.next', 'static'), join(app, '.next', 'static'), { recursive: true })
// The owner set-up script and the selling check run from the cPanel Terminal inside the app folder.
for (const script of ['set-owner.mjs', 'check-database.mjs']) cpSync(join('scripts', script), join(app, script))
// Secrets stay out of the upload; they go in the cPanel environment variables instead.
for (const file of ['.env', '.env.local', '.env.production']) rmSync(join(app, file), { force: true })

if (process.argv.includes('--no-zip')) process.exit(0)
const zip = 'siaabmobile-cpanel.zip'
rmSync(zip, { force: true })
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${app}\\*' -DestinationPath '${zip}'`], { stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', join('..', '..', zip), '.'], { cwd: app, stdio: 'inherit' })
}
if (!existsSync(zip)) { logError('The zip was not created.'); process.exit(1) }
log(`Ready: ${zip}. Upload it to cPanel, extract it into the app folder and set the startup file to server.js.`)
