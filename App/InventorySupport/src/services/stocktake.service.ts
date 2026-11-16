import { Product, Paginated } from "../types";
import { request } from "./api";

export interface CountedItem {
  productId: string;
  productName: string;
  barcode: string;
  unit: string;
  baselineQuantity: number;
  baselineStockVersion: number;
  countedQuantity: number;
  revision: number;
}
export interface StocktakeSession {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  revision: number;
  createdAt: string;
  reason?: string;
  items: CountedItem[];
  countedCount: number;
  adjustedCount: number;
}
export interface IdentifiedCount {
  product: Product;
  baselineQuantity: number;
  baselineStockVersion: number;
  item?: CountedItem;
}
const path = (id: string) => `/stocktakes/${encodeURIComponent(id)}`;
export const stocktakeService = {
  list: (token: string, page = 1) =>
    request<Paginated<StocktakeSession>>("/stocktakes", {
      token,
      query: { page, limit: 20 },
    }),
  create: (token: string) =>
    request<StocktakeSession>("/stocktakes", { token, method: "POST" }),
  get: (token: string, id: string) =>
    request<StocktakeSession>(path(id), { token }),
  identify: (
    token: string,
    id: string,
    body: { raw?: string; productId?: string },
  ) =>
    request<IdentifiedCount>(`${path(id)}/identify`, {
      token,
      method: "POST",
      body,
    }),
  save: (
    token: string,
    id: string,
    identified: IdentifiedCount,
    countedQuantity: number,
  ) =>
    request(`${path(id)}/items/${encodeURIComponent(identified.product.id)}`, {
      token,
      method: "PUT",
      body: {
        countedQuantity,
        baselineStockVersion: identified.baselineStockVersion,
        expectedUnit: identified.product.unit,
        expectedRevision: identified.item?.revision ?? 0,
      },
    }),
  remove: (token: string, id: string, item: CountedItem) =>
    request(`${path(id)}/items/${encodeURIComponent(item.productId)}`, {
      token,
      method: "DELETE",
      body: { expectedRevision: item.revision },
    }),
  finish: (
    token: string,
    session: StocktakeSession,
    action: "complete" | "cancel",
    reason?: string,
  ) =>
    request(`${path(session.id)}/${action}`, {
      token,
      method: "POST",
      body: { expectedRevision: session.revision, reason },
    }),
};
