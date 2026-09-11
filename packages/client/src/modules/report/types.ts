import type { Filter } from '../db/types'

export interface ReportViewArgs<T = object> {
    doctype: string
    fields?: string[]
    filters?: Filter<T>[] | Record<string, unknown>
    orFilters?: Filter<T>[]
    orderBy?: string
    start?: number
    pageLength?: number
    groupBy?: string
}

export interface ReportViewCompressed {
    keys: string[]
    values: unknown[][]
    user_info?: Record<string, unknown>
}

export interface QueryReportRunArgs {
    ignorePreparedReport?: boolean
    customColumns?: unknown[]
    isTree?: boolean
    parentField?: string
    areDefaultFilters?: boolean
    jsFilters?: unknown[]
    user?: string
}

export interface QueryReportResult {
    result?: unknown[]
    columns?: unknown[]
    message?: unknown
    chart?: unknown
    report_summary?: unknown
    skip_total_row?: number
    status?: string | null
    execution_time?: number
    add_total_row?: number | boolean
    prepared_report?: boolean
    [key: string]: unknown
}

export interface QueryReportScript {
    script?: string
    html_format?: string
    execution_time?: number
    filters?: unknown
    custom_report_name?: string | null
}

export interface PreparedReportRef {
    name: string
    [key: string]: unknown
}
