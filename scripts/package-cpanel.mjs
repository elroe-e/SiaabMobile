// Builds the site as a self-contained Node server and zips it for upload to cPanel "Setup Node.js App".
// NEXT_PUBLIC_* values are baked in at build time, so .env.local must hold the live Supabase URL, anon key and site URL.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { error as logError, log } from 'node:console'

for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SITE_URL']) {
  if (!process.env[name]) {
    logError(`Set ${name} in .env.local first; without it the live site would show sample phones instead of your shop.`)
    process.exit(1)
  }
}

execFileSync('npx next build', { stdio: 'inherit', shell: true, env: { ...process.env, NEXT_OUTPUT: 'standalone' } })

const app = join('.next', 'standalone')
// The standalone server does not include the browser files; they have to sit next to it.
cpSync('public', join(app, 'public'), { recursive: true })
cpSync(join('.next', 'static'), join(app, '.next', 'static'), { recursive: true })
// Secrets stay out of the upload; they go in the cPanel environment variables instead.
for (const file of ['.env', '.env.local', '.env.production']) rmSync(join(app, file), { force: true })

const zip = 'siaabmobile-cpanel.zip'
rmSync(zip, { force: true })
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${app}\\*' -DestinationPath '${zip}'`], { stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', join('..', '..', zip), '.'], { cwd: app, stdio: 'inherit' })
}
if (!existsSync(zip)) { logError('The zip was not created.'); process.exit(1) }
log(`Ready: ${zip}. Upload it to cPanel, extract it into the app folder and set the startup file to server.js.`)
