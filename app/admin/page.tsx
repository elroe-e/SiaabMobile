import Link from 'next/link'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { AdminShell } from './admin-shell'
import { SalesTrend } from './sales-trend'
import { BackupLink, BackupStatus } from './backup-status'
import { requireAdminPage } from '../../src/lib/auth/session'

export const dynamic = 'force-dynamic'

function money(value: number) {
  return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(value)
}

export default async function AdminDashboard() {
  const { db, profile } = await requireAdminPage()
  const [models, variants, units, leads, sales, lowStock, latestLeads] = await Promise.all([
    db.from('phone_models').select('id', { count: 'exact', head: true }),
    db.from('variants').select('id', { count: 'exact', head: true }),
    db.from('used_units').select('id', { count: 'exact', head: true }),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    db.from('sales').select('sale_price,sold_at,kind,undone_at').is('undone_at', null).gte('sold_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('sold_at', { ascending: true }),
    db.from('variants').select('id,stock_count,low_stock_threshold,model_id,phone_models(name,brands(name))').lte('stock_count', 2).limit(8),
    db.from('leads').select('id,type,name,contact,status,created_at').order('created_at', { ascending: false }).limit(5),
  ])
  const error = models.error ?? variants.error ?? units.error ?? leads.error ?? sales.error ?? lowStock.error ?? latestLeads.error
  if (error) throw new Error(`Could not load the admin dashboard: ${error.message}`)

  const weekRevenue = (sales.data ?? []).reduce((total, sale) => total + Number(sale.sale_price), 0)
  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const key = day.toISOString().slice(0, 10)
    return {
      day: day.toLocaleDateString('en', { weekday: 'short' }),
      amount: (sales.data ?? []).filter((sale) => sale.sold_at.slice(0, 10) === key).reduce((total, sale) => total + Number(sale.sale_price), 0),
    }
  })

  return <AdminShell name={profile.full_name} role={profile.role}>
    <div className="admin-page-heading">
      <div><h2>Overview</h2><p>Sales, stock and customer requests</p></div>
      <Link className="button button-primary" href="/admin/inventory">Manage inventory <ArrowRight size={16} /></Link>
    </div>
    <section className="admin-stat-grid" aria-label="Store overview">
      <article className="admin-stat"><div className="admin-stat-head">Phone models</div><strong className="admin-stat-value">{models.count ?? 0}</strong><span className="admin-stat-note">Models in your catalog</span></article>
      <article className="admin-stat"><div className="admin-stat-head">Stock items</div><strong className="admin-stat-value">{(variants.count ?? 0) + (units.count ?? 0)}</strong><span className="admin-stat-note">New variants and used phones</span></article>
      <article className="admin-stat"><div className="admin-stat-head">New requests</div><strong className="admin-stat-value">{leads.count ?? 0}</strong><span className="admin-stat-note">Waiting for a response</span></article>
      <article className="admin-stat"><div className="admin-stat-head">Sales · 7 days</div><strong className="admin-stat-value">{money(weekRevenue)}</strong><span className="admin-stat-note">{sales.data?.length ?? 0} recorded transactions</span></article>
    </section>
    <section className="admin-dashboard-grid">
      <article className="admin-card">
        <div className="admin-card-title"><h3>Sales activity</h3><span>Last 7 days · gross sales</span></div>
        <SalesTrend data={trend} />
      </article>
      <article className="admin-card">
        <div className="admin-card-title"><h3>Stock to check</h3><Link href="/admin/inventory">View inventory <ArrowRight size={16} /></Link></div>
        {lowStock.data?.length ? lowStock.data.map((item) => {
          const model = Array.isArray(item.phone_models) ? item.phone_models[0] : item.phone_models
          return <div className="admin-alert-row" key={item.id}><strong>{model?.name}</strong><span>{item.stock_count === 0 ? 'Out of stock' : `${item.stock_count} left`}</span><span className={`admin-badge ${item.stock_count === 0 ? 'red' : 'amber'}`}><TriangleAlert size={16} /> {item.stock_count === 0 ? 'Restock' : 'Low'}</span></div>
        }) : <div className="admin-empty">All new-phone variants are above the low-stock threshold.</div>}
      </article>
      <article className="admin-card">
        <div className="admin-card-title"><h3>Recent requests</h3><Link href="/admin/leads">See all <ArrowRight size={16} /></Link></div>
        {latestLeads.data?.length ? latestLeads.data.map((lead) => <div className="admin-alert-row" key={lead.id}><strong>{lead.name}<small>{lead.type.replace('_', ' ')} · {lead.contact}</small></strong><span>{new Date(lead.created_at).toLocaleDateString()}</span><span className={`admin-badge ${lead.status === 'new' ? 'amber' : 'gray'}`}>{lead.status}</span></div>) : <div className="admin-empty">No customer requests yet.</div>}
      </article>
      <article className="admin-card">
        <div className="admin-card-title"><h3>Quick links</h3><span>Common tasks</span></div>
        <div className="admin-alert-row"><strong>Add a phone</strong><Link href="/admin/inventory?add=1">Create a model <ArrowRight size={16} /></Link></div>
        <div className="admin-alert-row"><strong>Record a transaction</strong><Link href="/admin/sales">Open sales <ArrowRight size={16} /></Link></div>
        {profile.role === 'owner' && <div className="admin-alert-row"><strong>Export a backup<small className="admin-wrap"><BackupStatus /></small></strong><BackupLink>Download ZIP <ArrowRight size={16} /></BackupLink></div>}
      </article>
    </section>
  </AdminShell>
}
