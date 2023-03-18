export interface Pagination {
    search?: string
    offset: number
    limit: number
}

export interface Document {
    uuid: string
    url: string
}