export interface Category {
    categoryID?: number
    categoryName: string
    categoryHexColor: string
}

export interface CategoryDetail extends Category {
    lastActive: Date
    forumCount: number
}