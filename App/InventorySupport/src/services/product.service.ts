import { createProduct, getProductByBarcode, getProducts } from './api';
export const productService = { list: getProducts, findByBarcode: getProductByBarcode, create: createProduct };
