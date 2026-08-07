export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export abstract class BaseRepository {
  protected async paginate<T>(
    query: Promise<T[]>,
    total: Promise<number>,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<T>> {
    const [data, totalItems] = await Promise.all([query, total]);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        total: totalItems,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
