import { Schema } from 'mongoose';
import {
  NotificationType,
  StockTransactionType,
  UserRole,
} from '../common/types.js';

const text = { type: String, required: true };
const iso = {
  ...text,
  validate: (value: string) =>
    /^\d{4}-\d\d-\d\dT/.test(value) && new Date(value).toISOString() === value,
};
const count = {
  type: Number,
  min: 0,
  required: true,
  validate: Number.isSafeInteger,
};
const money = {
  type: Number,
  min: 0,
  required: true,
  validate: Number.isFinite,
};
const base = { _id: text, storeId: text, createdAt: iso };
const options = { versionKey: false, id: false } as const;
const users = new Schema(
  {
    ...base,
    name: text,
    email: { ...text, lowercase: true, trim: true, unique: true },
    passwordHash: text,
    role: { ...text, enum: Object.values(UserRole) },
    active: { type: Boolean, required: true },
    pushTokens: { type: [String], default: [] },
    adminRevision: { type: Number, default: 0, select: false },
    updatedAt: iso,
  },
  options,
);
users.index(
  { pushTokens: 1 },
  {
    unique: true,
    partialFilterExpression: { 'pushTokens.0': { $exists: true } },
  },
);
const products = new Schema(
  {
    ...base,
    barcode: text,
    name: text,
    normalizedName: text,
    description: String,
    category: text,
    unit: text,
    price: money,
    costPrice: money,
    supplier: String,
    minStock: count,
    quantity: count,
    stockVersion: { ...count, default: 0 },
    imageUrl: String,
    updatedAt: iso,
    deletedAt: { ...iso, required: false },
  },
  options,
);
products.index({ storeId: 1, barcode: 1 }, { unique: true });
products.index({ storeId: 1, deletedAt: 1 });
const transactions = new Schema(
  {
    ...base,
    stocktakeSessionId: String,
    productId: text,
    productName: text,
    type: { ...text, enum: Object.values(StockTransactionType) },
    quantity: { type: Number, required: true, validate: Number.isSafeInteger },
    quantityBefore: count,
    quantityAfter: count,
    reason: String,
    createdBy: text,
    createdByName: text,
  },
  options,
);
transactions.index({ storeId: 1, createdAt: -1 });
transactions.index({ storeId: 1, productId: 1, createdAt: -1 });
const notifications = new Schema(
  {
    ...base,
    type: { ...text, enum: Object.values(NotificationType) },
    productId: text,
    title: text,
    message: text,
    readBy: { type: [String], default: [] },
  },
  options,
);
notifications.index({ storeId: 1, createdAt: -1 });
const stocktake_sessions = new Schema(
  {
    ...base,
    createdBy: text,
    createdByName: text,
    status: { ...text, enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
    revision: count,
    reason: String,
    updatedAt: iso,
    completedAt: String,
    cancelledAt: String,
    result: { type: Schema.Types.Mixed },
  },
  options,
);
stocktake_sessions.index({ storeId: 1, createdBy: 1, updatedAt: -1 });
stocktake_sessions.index(
  { storeId: 1, createdBy: 1 },
  { unique: true, partialFilterExpression: { status: 'IN_PROGRESS' } },
);
const stocktake_items = new Schema(
  {
    ...base,
    sessionId: text,
    productId: text,
    productName: text,
    barcode: text,
    unit: text,
    baselineQuantity: count,
    baselineStockVersion: count,
    countedQuantity: count,
    revision: count,
    countedBy: text,
    countedAt: iso,
    updatedAt: iso,
  },
  options,
);
stocktake_items.index({ sessionId: 1, productId: 1 }, { unique: true });
stocktake_items.index({ storeId: 1, sessionId: 1 });
export const models = Object.entries({
  stocktake_sessions,
  stocktake_items,
  users,
  products,
  transactions,
  notifications,
}).map(([name, schema]) => ({ name, schema, collection: name }));
