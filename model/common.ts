export interface Pagination {
    search?: string
    offset: number
    limit: number
    sortBy?: string
}

export interface Document {
    uuid: string
    url: string
}