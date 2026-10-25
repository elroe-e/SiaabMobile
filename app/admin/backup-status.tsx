'use client'

import { useEffect, useState } from 'react'

const BACKUP_KEY = 'siaab-last-backup'
const DAY = 86_400_000

const markDownloaded = () => {
  try { localStorage.setItem(BACKUP_KEY, String(Date.now())) } catch { /* private mode: the reminder just keeps showing */ }
}

/** Download link that remembers (in this browser) when the owner last took a backup. */
export function BackupLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return <a className={className} href="/api/admin/export" onClick={markDownloaded}>{children}</a>
}

export function BackupStatus() {
  const [days, setDays] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(BACKUP_KEY))
      setDays(stored ? Math.floor((Date.now() - stored) / DAY) : null)
    } catch { setDays(null) }
  }, [])
  if (days === undefined) return null
  const overdue = days === null || days >= 30
  const label = days === null ? 'No backup has been downloaded from this browser yet.' : days === 0 ? 'Last backup: today.' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago.`
  return <span className={overdue ? 'admin-backup-overdue' : 'admin-backup-ok'} role={overdue ? 'status' : undefined}>{label}{overdue ? ' Download one now.' : ''}</span>
}
