import type { RequestOptions } from '../../core/types'
import { jsonParam } from '../../core/url'
import type { ModuleDeps } from '../deps'
import type {
    PreparedReportRef,
    QueryReportResult,
    QueryReportRunArgs,
    QueryReportScript,
    ReportViewArgs,
    ReportViewCompressed,
} from './types'

function toBlob(data: unknown): Blob {
    if (data instanceof Blob) return data
    if (data instanceof ArrayBuffer) return new Blob([data])
    if (typeof data === 'string') return new Blob([data])
    return new Blob([])
}

class FrappeReportImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    get(args: ReportViewArgs, options?: RequestOptions): Promise<ReportViewCompressed> {
        return this.executor.call<ReportViewCompressed>(
            { method: 'GET', url: this.adapter.method('frappe.desk.reportview.get'), params: this.viewParams(args) },
            'envelope',
            options,
        )
    }

    getList<T = object>(args: ReportViewArgs<T>, options?: RequestOptions): Promise<T[]> {
        return this.executor.call<T[]>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.reportview.get_list'),
                params: this.viewParams(args),
            },
            'envelope',
            options,
        )
    }

    /** Row count for a report view. Named `countRows` so it is not confused with `db.getCount`. */
    countRows<T = object>(args: ReportViewArgs<T>, options?: RequestOptions): Promise<number | null> {
        return this.executor.call<number | null>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.reportview.get_count'),
                params: this.viewParams(args),
            },
            'envelope',
            options,
        )
    }

    run(
        reportName: string,
        filters?: Record<string, unknown> | string,
        args?: QueryReportRunArgs,
        options?: RequestOptions,
    ): Promise<QueryReportResult> {
        return this.executor.call<QueryReportResult>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.desk.query_report.run'),
                data: {
                    report_name: reportName,
                    filters,
                    user: args?.user,
                    ignore_prepared_report: args?.ignorePreparedReport,
                    custom_columns: args?.customColumns,
                    is_tree: args?.isTree,
                    parent_field: args?.parentField,
                    are_default_filters: args?.areDefaultFilters,
                    js_filters: args?.jsFilters,
                },
            },
            'envelope',
            options,
        )
    }

    getScript(reportName: string, options?: RequestOptions): Promise<QueryReportScript> {
        return this.executor.call<QueryReportScript>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.desk.query_report.get_script'),
                params: { report_name: reportName },
            },
            'envelope',
            options,
        )
    }

    prepare(
        reportName: string,
        filters?: Record<string, unknown> | string,
        options?: RequestOptions,
    ): Promise<PreparedReportRef> {
        return this.executor.call<PreparedReportRef>(
            {
                method: 'POST',
                url: this.adapter.method('frappe.core.doctype.prepared_report.prepared_report.make_prepared_report'),
                data: { report_name: reportName, filters },
            },
            'envelope',
            options,
        )
    }

    getQueued(
        reportName: string,
        filters: Record<string, unknown> | string,
        options?: RequestOptions,
    ): Promise<unknown[]> {
        return this.executor.call<unknown[]>(
            {
                method: 'GET',
                url: this.adapter.method(
                    'frappe.core.doctype.prepared_report.prepared_report.get_reports_in_queued_state',
                ),
                params: { report_name: reportName, filters },
            },
            'envelope',
            options,
        )
    }

    /** Delete a prepared report (Frappe's stop/cancel path). */
    stop(preparedReportName: string, options?: RequestOptions): Promise<unknown> {
        return this.executor.call(
            {
                method: 'POST',
                url: this.adapter.method('frappe.core.doctype.prepared_report.prepared_report.delete_prepared_reports'),
                data: { reports: jsonParam([{ name: preparedReportName }]) },
            },
            'envelope',
            options,
        )
    }

    async download(preparedReportName: string, options?: RequestOptions): Promise<Blob> {
        const data = await this.executor.call<unknown>(
            {
                method: 'GET',
                url: this.adapter.method('frappe.core.doctype.prepared_report.prepared_report.download_attachment'),
                params: { dn: preparedReportName },
                responseType: 'arraybuffer',
            },
            'none',
            options,
        )
        return toBlob(data)
    }

    private viewParams<T>(args: ReportViewArgs<T>): Record<string, unknown> {
        return {
            doctype: args.doctype,
            fields: jsonParam(args.fields),
            filters: jsonParam(args.filters),
            or_filters: jsonParam(args.orFilters),
            order_by: args.orderBy,
            start: args.start,
            page_length: args.pageLength,
            group_by: args.groupBy,
        }
    }
}

export type FrappeReport = FrappeReportImpl

/** @internal */
export function createFrappeReport(deps: ModuleDeps): FrappeReport {
    return new FrappeReportImpl(deps)
}

export * from './types'
