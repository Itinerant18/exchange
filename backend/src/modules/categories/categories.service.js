import { AppError } from '../../appErrors/AppError.js';
import { pool, withTransaction } from '../../config/database.js';
import { writeAuditLog } from '../../services/auditLogService.js';
import { expectInt, expectString, isUuid } from '../../utils/validators.js';
import { translatePgError } from '../../utils/pgErrorMapper.js';
import * as repository from './categories.repository.js';

const MAX_CATEGORY_DEPTH = 5;

// ------------------------------------------------------------------- queries

export async function listPublicCategories() {
  return repository.listPublicCategories();
}

export async function listAdminCategories() {
  return repository.listAdminCategories();
}

export async function getPublicCategory(categoryId) {
  const category = await repository.findCategoryById(categoryId);
  if (!category || !category.isActive) {
    throw new AppError('Category not found.', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
  }
  return category;
}

/** Admin detail view: any status. */
export async function getAnyCategoryForAdmin(categoryId) {
  const category = await repository.findCategoryById(categoryId);
  if (!category) {
    throw new AppError('Category not found.', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
  }
  return category;
}

/** Internally used by the listings module: resolves an active parent for offers. */
export async function requireActiveCategory(categoryId) {
  const category = await repository.findCategoryById(categoryId);
  if (!category) {
    throw new AppError('Category not found.', { statusCode: 400, code: 'CATEGORY_NOT_FOUND' });
  }
  if (!category.isActive) {
    throw new AppError('This category is no longer accepting new listings.', {
      statusCode: 409,
      code: 'CATEGORY_INACTIVE',
    });
  }
  return category;
}

// --------------------------------------------------------------------- admin

export async function adminCreateCategory(user, context, body) {
  const name = expectString(body.name, 'name', { min: 2, max: 100 });
  const description = body.description === undefined || body.description === null
    ? null
    : expectString(body.description, 'description', { min: 1, max: 2000 });
  const imageUrl = body.imageUrl === undefined || body.imageUrl === null
    ? null
    : expectString(body.imageUrl, 'imageUrl', { min: 3, max: 500 });
  const displayOrder = body.displayOrder === undefined
    ? 0
    : expectInt(body.displayOrder, 'displayOrder', { min: 0, max: 9999 });
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

  let parentId = null;
  if (body.parentId !== undefined && body.parentId !== null) {
    if (!isUuid(body.parentId)) {
      throw new AppError('parentId must be a valid category identifier.', { statusCode: 400, code: 'INVALID_ID' });
    }
    parentId = body.parentId;
    await assertParentUsable(parentId);
  }

  const slug = slugify(body.slug ?? name);
  if (!slug) {
    throw new AppError('name must contain at least one letter or digit.', { statusCode: 400 });
  }

  try {
    const created = await withTransaction((client) =>
      repository.insertCategory({ parent_id: parentId, name, slug, description, image_url: imageUrl, display_order: displayOrder, is_active: isActive }, client));
    await withTransaction((client) =>
      writeAuditLog(client, { ...context, action: 'CATEGORY_CREATED', entityType: 'category', entityId: created.id, newValue: { name, slug } }));
    return created;
  } catch (error) {
    throw translatePgError(error);
  }
}

export async function adminUpdateCategory(user, context, categoryId, body) {
  const fields = {};

  if (body.name !== undefined) {
    fields.name = expectString(body.name, 'name', { min: 2, max: 100 });
  }
  if (body.slug !== undefined) {
    fields.slug = slugify(body.slug) || undefined;
    if (!fields.slug) throw new AppError('slug is not valid.', { statusCode: 400 });
  }
  if (body.description !== undefined) {
    fields.description = body.description === null ? null : expectString(body.description, 'description', { min: 1, max: 2000 });
  }
  if (body.imageUrl !== undefined) {
    fields.image_url = body.imageUrl === null ? null : expectString(body.imageUrl, 'imageUrl', { min: 3, max: 500 });
  }
  if (body.displayOrder !== undefined) {
    fields.display_order = expectInt(body.displayOrder, 'displayOrder', { min: 0, max: 9999 });
  }
  if (body.isActive !== undefined) {
    fields.is_active = Boolean(body.isActive);
  }

  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      fields.parent_id = null;
    } else {
      if (!isUuid(body.parentId)) {
        throw new AppError('parentId must be a valid category identifier.', { statusCode: 400, code: 'INVALID_ID' });
      }
      if (body.parentId === categoryId) {
        throw new AppError('A category cannot be its own parent.', { statusCode: 409, code: 'CATEGORY_CYCLE' });
      }
      // Cycle protection: the new parent's ancestor chain must not include the
      // moved category itself (the DB CHECK only blocks direct self-parents).
      const ancestors = await repository.getAncestorIds(body.parentId);
      if (ancestors.includes(categoryId)) {
        throw new AppError('Moving this category under the target parent would create a cycle.', {
          statusCode: 409,
          code: 'CATEGORY_CYCLE',
        });
      }
      if (ancestors.length >= MAX_CATEGORY_DEPTH) {
        throw new AppError(`Category nesting is limited to ${MAX_CATEGORY_DEPTH} levels.`, {
          statusCode: 409,
          code: 'MAX_CATEGORY_DEPTH',
        });
      }
      await assertParentUsable(body.parentId);
      fields.parent_id = body.parentId;
    }
  }

  // Deactivation is refused while active children exist; deactivate children first.
  const deactivating = fields.is_active === false;
  if (deactivating) {
    const activeChildren = await repository.countActiveChildren(categoryId);
    if (activeChildren > 0) {
      throw new AppError('This category has active subcategories. Deactivate them first.', {
        statusCode: 409,
        code: 'CATEGORY_HAS_ACTIVE_CHILDREN',
      });
    }
  }

  try {
    const updated = await withTransaction(async (client) => {
      const row = await repository.updateCategory(categoryId, fields, client);
      if (!row) return null;
      await writeAuditLog(client, { ...context, action: 'CATEGORY_UPDATED', entityType: 'category', entityId: categoryId, newValue: fields });
      return row;
    });
    if (!updated) {
      throw new AppError('Category not found.', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
    }
    return updated;
  } catch (error) {
    throw translatePgError(error);
  }
}

/**
 * DELETE semantics: categories are deactivated, never hard-deleted (listings
 * and history reference them via RESTRICT foreign keys).
 */
export async function adminDeactivateCategory(user, context, categoryId) {
  const activeChildren = await repository.countActiveChildren(categoryId);
  if (activeChildren > 0) {
    throw new AppError('This category has active subcategories. Deactivate them first.', {
      statusCode: 409,
      code: 'CATEGORY_HAS_ACTIVE_CHILDREN',
    });
  }
  const deactivated = await withTransaction((client) =>
    repository.setCategoryActive(categoryId, false, client));
  if (!deactivated) {
    throw new AppError('Category not found.', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
  }
  await withTransaction((client) =>
    writeAuditLog(client, { ...context, action: 'CATEGORY_DEACTIVATED', entityType: 'category', entityId: categoryId }));
  return deactivated;
}

async function assertParentUsable(parentId) {
  const parent = await repository.findCategoryById(parentId);
  if (!parent) {
    throw new AppError('Parent category not found.', { statusCode: 400, code: 'CATEGORY_NOT_FOUND' });
  }
  if (!parent.isActive) {
    throw new AppError('The parent category is not active.', { statusCode: 409, code: 'CATEGORY_INACTIVE' });
  }
}

/** Lowercase alphanum slug; unknown characters collapse into single dashes. */
function slugify(value) {
  if (typeof value !== 'string') return null;
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug.length > 0 ? slug : null;
}
