export interface Category {
    categoryID?: number
    categoryName: string
    categoryHexColor: string
}

export interface CategoryDetail extends Category {
    lastActive: Date
    forumCount: number
    total?: number
    ranking?: number
}

export interface CategoryOccurrence extends Category {
    total: number
    ranking: number
}

export interface Occurrence {
    [categoryID: number]: number
}