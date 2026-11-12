import 'server-only'
import { getDatabase, type Actor } from './pool'
import { photoBucket } from './photos'

/**
 * A small SQL builder with the same call shape the site used with Supabase (`from().select().eq()`, `rpc()`),
 * so pages and routes keep their code. Names are checked against a strict pattern; every value is a bound parameter.
 */
export type DbError = { message: string; code?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows come from SQL; pages read the columns they selected
export type Row = Record<string, any>
export type DbResult<T> = { data: T; error: null; count?: number | null } | { data: null; error: DbError; count?: null }

const NAME = /^[a-z_][a-z0-9_]*$/
function quote(name: string) {
  if (!NAME.test(name)) throw new Error(`Invalid database name: ${name}`)
  return `"${name}"`
}

// Many-to-one links pages embed, e.g. variants -> phone_models(name, brands(name)).
const LINKS: Record<string, string> = { brands: 'brand_id', phone_models: 'model_id', variants: 'variant_id', used_units: 'unit_id' }

type Field = { name: string; children?: Field[] }

/** Parses "id,name,phone_models(name,brands(name))" into a tree. */
export function parseSelect(text: string): Field[] {
  const fields: Field[] = []
  let index = 0
  const readList = (into: Field[]) => {
    let name = ''
    const flush = () => { const trimmed = name.trim(); if (trimmed) into.push({ name: trimmed }); name = '' }
    while (index < text.length) {
      const char = text[index++]
      if (char === ',') flush()
      else if (char === '(') { const children: Field[] = []; readList(children); into.push({ name: name.trim(), children }); name = '' }
      else if (char === ')') { flush(); return }
      else name += char
    }
    flush()
  }
  readList(fields)
  return fields
}

function columns(fields: Field[], alias: string, depth = 0): string[] {
  return fields.map((field) => {
    if (field.name === '*' && !field.children) return `${alias}.*`
    if (!field.children) return `${alias}.${quote(field.name)}`
    return `${embed(field, alias, depth)} as ${quote(field.name)}`
  })
}

function embed(field: Field, parentAlias: string, depth: number): string {
  const link = LINKS[field.name]
  if (!link) throw new Error(`Cannot embed ${field.name}`)
  const alias = `e${depth + 1}`
  const pairs = (field.children ?? []).map((child) => child.children
    ? `'${child.name}', ${embed(child, alias, depth + 1)}`
    : `'${quote(child.name).slice(1, -1)}', ${alias}.${quote(child.name)}`)
  return `(select json_build_object(${pairs.join(', ')}) from public.${quote(field.name)} ${alias} where ${alias}.id = ${parentAlias}.${quote(link)})`
}

// Plain objects and arrays are stored as JSON; everything else goes to pg as is.
const toParam = (value: unknown) => value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Uint8Array) ? JSON.stringify(value) : value

const asError = (error: unknown): DbError => {
  const pgError = error as { message?: string; code?: string }
  return { message: pgError?.message ?? 'Database request failed.', ...(pgError?.code ? { code: pgError.code } : {}) }
}

type Mode = 'many' | 'single' | 'maybe'
type Action = { kind: 'select' } | { kind: 'insert'; rows: Record<string, unknown>[] } | { kind: 'upsert'; rows: Record<string, unknown>[]; onConflict: string } | { kind: 'update'; values: Record<string, unknown> } | { kind: 'delete' }

class Query<T = Row[]> implements PromiseLike<DbResult<T>> {
  private action: Action = { kind: 'select' }
  private fields: Field[] | null = null
  private countOnly = false
  private filters: { sql: (param: (value: unknown) => string) => string }[] = []
  private orders: string[] = []
  private max: number | null = null
  private skip = 0
  private mode: Mode = 'many'

  constructor(private table: string, private actor?: Actor | undefined) { quote(table) }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- accepts the old typed-select call shape
  select<_Shape = unknown>(text = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.fields = parseSelect(text)
    if (options?.head && options.count) this.countOnly = true
    return this
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) { this.action = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] }; return this }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) { this.action = { kind: 'upsert', rows: Array.isArray(rows) ? rows : [rows], onConflict: options?.onConflict ?? 'id' }; return this }
  update(values: Record<string, unknown>) { this.action = { kind: 'update', values }; return this }
  delete() { this.action = { kind: 'delete' }; return this }

  private where(column: string, operator: string, value: unknown) {
    const name = quote(column)
    this.filters.push({ sql: (param) => `t.${name} ${operator} ${param(value)}` })
    return this
  }
  eq(column: string, value: unknown) { return value === null ? this.is(column, null) : this.where(column, '=', value) }
  neq(column: string, value: unknown) { return this.where(column, '<>', value) }
  gt(column: string, value: unknown) { return this.where(column, '>', value) }
  gte(column: string, value: unknown) { return this.where(column, '>=', value) }
  lt(column: string, value: unknown) { return this.where(column, '<', value) }
  lte(column: string, value: unknown) { return this.where(column, '<=', value) }
  in(column: string, values: unknown[]) {
    const name = quote(column)
    this.filters.push({ sql: (param) => values.length ? `t.${name} in (${values.map(param).join(', ')})` : 'false' })
    return this
  }
  is(column: string, value: null | boolean) {
    const name = quote(column)
    this.filters.push({ sql: () => `t.${name} is ${value === null ? 'null' : value ? 'true' : 'false'}` })
    return this
  }
  not(column: string, operator: 'is', value: null) {
    const name = quote(column)
    if (operator !== 'is' || value !== null) throw new Error('Only not(column, "is", null) is supported')
    this.filters.push({ sql: () => `t.${name} is not null` })
    return this
  }
  ilike(column: string, pattern: string) { return this.where(column, 'ilike', pattern) }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push(`t.${quote(column)} ${options?.ascending === false ? 'desc' : 'asc'}`); return this }
  limit(count: number) { this.max = Math.max(0, Math.floor(count)); return this }
  range(from: number, to: number) { this.skip = Math.max(0, Math.floor(from)); this.max = Math.max(0, Math.floor(to) - this.skip + 1); return this }
  single<R = Row>() { this.mode = 'single'; return this as unknown as Query<R> }
  maybeSingle<R = Row>() { this.mode = 'maybe'; return this as unknown as Query<R | null> }

  /** Builds the SQL and its parameters; exported through toSql for tests. */
  toSql(): { text: string; params: unknown[] } {
    const params: unknown[] = []
    const param = (value: unknown) => { params.push(toParam(value)); return `$${params.length}` }
    const table = `public.${quote(this.table)}`
    const where = this.filters.length ? ` where ${this.filters.map((filter) => filter.sql(param)).join(' and ')}` : ''
    const returning = this.fields ? ` returning ${columns(this.fields, 't').join(', ')}` : ''
    const action = this.action
    if (action.kind === 'select') {
      if (this.countOnly) return { text: `select count(*)::int as count from ${table} t${where}`, params }
      const list = columns(this.fields ?? [{ name: '*' }], 't').join(', ')
      const order = this.orders.length ? ` order by ${this.orders.join(', ')}` : ''
      const limit = this.max !== null ? ` limit ${this.max}` : ''
      const offset = this.skip ? ` offset ${this.skip}` : ''
      return { text: `select ${list} from ${table} t${where}${order}${limit}${offset}`, params }
    }
    if (action.kind === 'insert' || action.kind === 'upsert') {
      if (!action.rows.length) throw new Error('Nothing to insert')
      const names = [...new Set(action.rows.flatMap((row) => Object.keys(row)))]
      const values = action.rows.map((row) => `(${names.map((name) => name in row ? param(row[name]) : 'default').join(', ')})`)
      let text = `insert into ${table} as t (${names.map(quote).join(', ')}) values ${values.join(', ')}`
      if (action.kind === 'upsert') {
        const conflict = action.onConflict.split(',').map((name) => name.trim())
        const updates = names.filter((name) => !conflict.includes(name)).map((name) => `${quote(name)} = excluded.${quote(name)}`)
        text += ` on conflict (${conflict.map(quote).join(', ')}) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'}`
      }
      return { text: text + returning, params }
    }
    // Updates and deletes without a filter would touch every row; refuse them.
    if (!this.filters.length) throw new Error(`Refusing to ${action.kind} every row of ${this.table}`)
    if (action.kind === 'update') {
      const sets = Object.entries(action.values).map(([name, value]) => `${quote(name)} = ${param(value)}`)
      if (!sets.length) throw new Error('Nothing to update')
      return { text: `update ${table} as t set ${sets.join(', ')}${where}${returning}`, params }
    }
    return { text: `delete from ${table} as t${where}${returning}`, params }
  }

  private async execute(): Promise<DbResult<T>> {
    try {
      const { text, params } = this.toSql()
      const { rows } = await getDatabase().run((runner) => runner.query(text, params), this.actor)
      if (this.countOnly) return { data: null as T, error: null, count: Number(rows[0]?.count ?? 0) }
      const writesWithoutSelect = this.action.kind !== 'select' && !this.fields
      if (writesWithoutSelect) return { data: null as T, error: null }
      if (this.mode === 'many') return { data: rows as T, error: null }
      if (rows.length > 1 || (this.mode === 'single' && rows.length === 0)) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
      }
      return { data: (rows[0] ?? null) as T, error: null }
    } catch (error) {
      return { data: null, error: asError(error) }
    }
  }

  then<A = DbResult<T>, B = never>(onfulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

/** Calls a database function with named arguments, e.g. sell_variant(p_variant_id => …). */
async function rpc(name: string, args: Record<string, unknown> = {}, actor?: Actor): Promise<DbResult<any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const params: unknown[] = []
    const list = Object.entries(args).map(([key, value]) => { params.push(toParam(value)); return `${quote(key)} => $${params.length}` })
    const { rows } = await getDatabase().run((runner) => runner.query(`select public.${quote(name)}(${list.join(', ')}) as result`, params), actor)
    return { data: rows[0]?.result ?? null, error: null }
  } catch (error) {
    return { data: null, error: asError(error) }
  }
}

export type DbClient = ReturnType<typeof createDbClient>

/** The public site uses it without an actor; signed-in requests pass the person acting. */
export function createDbClient(actor?: Actor) {
  return {
    from: (table: string) => new Query(table, actor),
    rpc: (name: string, args?: Record<string, unknown>) => rpc(name, args, actor),
    storage: { from: (_bucket: string) => photoBucket },
  }
}
