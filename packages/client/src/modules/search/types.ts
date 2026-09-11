export interface LinkSearchResult {
    value: string
    description: string
    label?: string
}

export interface SearchLinkArgs {
    query?: string
    filters?: Record<string, unknown> | unknown[]
    pageLength?: number
    searchField?: string
    referenceDoctype?: string
    ignoreUserPermissions?: boolean
    linkFieldname?: string
}

export interface SearchWidgetArgs extends SearchLinkArgs {
    start?: number
    filterFields?: string[]
    asDict?: boolean
}
