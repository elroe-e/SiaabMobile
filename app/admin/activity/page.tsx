import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { requireAdmin } from '../../../src/lib/supabase/auth'

export const metadata: Metadata = { title: 'Security activity' }
export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const { supabase, profile } = await requireAdmin('owner')
  const { data, error } = await supabase.from('audit_log').select('id,user_id,action,table_name,record_id,before,after,created_at').order('created_at', { ascending: false }).limit(300)
  if (error) throw new Error(`Could not load activity: ${error.message}`)
  return <AdminShell name={profile.full_name} role={profile.role}>
    <div className="admin-page-heading"><div><h2>Security activity</h2><p>Owner-only history of inventory, shop settings and trade-in changes.</p></div><span className="admin-badge">{data.length} recent events</span></div>
    <div className="admin-alert">Audit entries may contain private inventory information. Keep access to this page and exported backups limited to the owner.</div>
    <article className="admin-card">
      {!data.length ? <div className="admin-empty">No activity has been recorded yet.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Action</th><th>Resource</th><th>Actor</th><th>Change details</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td><span className={`admin-badge ${item.action === 'DELETE' ? 'red' : item.action === 'INSERT' ? 'green' : 'amber'}`}>{item.action}</span></td><td><strong>{item.table_name}</strong><small>{item.record_id ?? '—'}</small></td><td><small>{item.user_id ?? 'System / unknown'}</small></td><td><details><summary>View before / after</summary><pre className="admin-json">{JSON.stringify({ before: item.before, after: item.after }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}
    </article>
  </AdminShell>
}
