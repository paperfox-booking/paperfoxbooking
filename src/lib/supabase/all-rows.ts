/**
 * Supabase returns at most 1,000 rows at a time. This reads a query page by
 * page until it has every row, for reports and lists that can grow past
 * that (a year's payments, for example). The query must have a fixed order.
 */
export async function allRows<Row>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
