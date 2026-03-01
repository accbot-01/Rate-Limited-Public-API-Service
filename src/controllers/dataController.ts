import { Request, Response } from 'express';
import db from '../models/database';
import { asyncHandler } from '../utils/errors';
import { PaginatedResponse } from '../types';

interface PublicDataItem {
  id: number;
  title: string;
  description: string;
  category: string;
  value: string;
  createdAt: Date;
}

/**
 * Get paginated public data
 */
export const getPublicData = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  // Count total records
  const countResult = await db.query('SELECT COUNT(*) FROM public_data');
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch paginated data
  const dataResult = await db.query(
    'SELECT id, title, description, category, value, created_at FROM public_data ORDER BY id LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  const response: PaginatedResponse<PublicDataItem> = {
    data: dataResult.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      value: row.value,
      createdAt: row.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  };

  res.status(200).json(response);
});
