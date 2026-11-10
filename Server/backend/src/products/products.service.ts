import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthUser, Product } from '../common/types.js';
import {
  optionalNumber,
  optionalString,
  paginate,
  parsePageQuery,
  requiredString,
} from '../common/validation.js';
import { isOwnUploadPath } from '../uploads/upload-paths.js';
import { CreateProductDto, ProductQuery, UpdateProductDto } from './dto/create-product.dto.js';

/** Bỏ dấu tiếng Việt để tìm kiếm "mi hao hao" vẫn ra "Mì Hảo Hảo". */
export function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  /** Sản phẩm còn hoạt động (chưa xóa) của cửa hàng. */
  active(user: AuthUser): Product[] {
    return this.database.products.filter(
      (product) => product.storeId === user.storeId && !product.deletedAt,
    );
  }

  list(user: AuthUser, query: ProductQuery) {
    const search = query.search ? searchKey(query.search) : '';
    const items = this.active(user)
      .filter((product) => !query.category || product.category === query.category)
      .filter((product) => query.lowStock !== 'true' || product.quantity <= product.minStock)
      .filter((product) => {
        if (!search) return true;
        return searchKey(`${product.name} ${product.barcode} ${product.category} ${product.supplier}`).includes(search);
      })
      .sort((a, b) => {
        if (query.sort === 'quantity') return a.quantity - b.quantity;
        if (query.sort === 'updatedAt') return b.updatedAt.localeCompare(a.updatedAt);
        return a.name.localeCompare(b.name, 'vi');
      });
    return paginate(items, parsePageQuery(query));
  }

  categories(user: AuthUser): string[] {
    return [...new Set(this.active(user).map((product) => product.category))].sort((a, b) =>
      a.localeCompare(b, 'vi'),
    );
  }

  findById(id: string, user: AuthUser): Product {
    const product = this.active(user).find((candidate) => candidate.id === id);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product;
  }

  findByBarcode(barcode: string, user: AuthUser): Product {
    const code = barcode.trim();
    const product = this.active(user).find((candidate) => candidate.barcode === code);
    if (!product) throw new NotFoundException('Mã barcode chưa tồn tại');
    return product;
  }

  /** Tìm sản phẩm có sẵn khớp với gợi ý của AI (theo barcode hoặc tên). */
  match(user: AuthUser, hint: { barcode?: string; name: string }): Product[] {
    const products = this.active(user);
    if (hint.barcode) {
      const exact = products.find((product) => product.barcode === hint.barcode);
      if (exact) return [exact];
    }
    const words = searchKey(hint.name).split(/\s+/).filter((word) => word.length > 1);
    if (!words.length) return [];
    return products
      .map((product) => {
        const key = searchKey(`${product.name} ${product.normalizedName}`);
        return { product, score: words.filter((word) => key.includes(word)).length / words.length };
      })
      .filter(({ score }) => score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ product }) => product);
  }

  create(dto: CreateProductDto, user: AuthUser): Product {
    const name = requiredString(dto.name, 'Tên sản phẩm');
    const barcode = optionalString(dto.barcode, 'Barcode', 64) || this.generateCode();
    this.ensureUniqueBarcode(user, barcode);
    const now = new Date().toISOString();
    const product: Product = {
      id: this.database.createId('product'),
      storeId: user.storeId,
      barcode,
      name,
      normalizedName: name,
      description: optionalString(dto.description, 'Mô tả') ?? '',
      category: optionalString(dto.category, 'Danh mục', 80) || 'Khác',
      unit: optionalString(dto.unit, 'Đơn vị', 30) || 'cái',
      price: optionalNumber(dto.price, 'Giá bán') ?? 0,
      costPrice: optionalNumber(dto.costPrice, 'Giá nhập') ?? 0,
      supplier: optionalString(dto.supplier, 'Nhà cung cấp', 120) ?? '',
      minStock: optionalNumber(dto.minStock, 'Tồn tối thiểu', { integer: true }) ?? 0,
      imageUrl: this.checkImage(user, dto.imageUrl),
      quantity: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.database.products.push(product);
    this.database.save();
    return product;
  }

  update(id: string, dto: UpdateProductDto, user: AuthUser): Product {
    const product = this.findById(id, user);
    if (dto.barcode !== undefined) {
      const barcode = requiredString(dto.barcode, 'Barcode', 64);
      if (barcode !== product.barcode) this.ensureUniqueBarcode(user, barcode);
      product.barcode = barcode;
    }
    if (dto.name !== undefined) {
      product.name = requiredString(dto.name, 'Tên sản phẩm');
      product.normalizedName = product.name;
    }
    if (dto.description !== undefined) product.description = optionalString(dto.description, 'Mô tả') ?? '';
    if (dto.category !== undefined) product.category = optionalString(dto.category, 'Danh mục', 80) || 'Khác';
    if (dto.unit !== undefined) product.unit = optionalString(dto.unit, 'Đơn vị', 30) || 'cái';
    if (dto.supplier !== undefined) product.supplier = optionalString(dto.supplier, 'Nhà cung cấp', 120) ?? '';
    if (dto.price !== undefined) product.price = optionalNumber(dto.price, 'Giá bán') ?? 0;
    if (dto.costPrice !== undefined) product.costPrice = optionalNumber(dto.costPrice, 'Giá nhập') ?? 0;
    if (dto.minStock !== undefined) {
      product.minStock = optionalNumber(dto.minStock, 'Tồn tối thiểu', { integer: true }) ?? 0;
    }
    if (dto.imageUrl !== undefined) product.imageUrl = this.checkImage(user, dto.imageUrl);
    product.updatedAt = new Date().toISOString();
    this.database.save();
    return product;
  }

  /** Xóa mềm: sản phẩm biến mất khỏi danh sách nhưng lịch sử giao dịch vẫn còn. */
  remove(id: string, user: AuthUser) {
    const product = this.findById(id, user);
    product.deletedAt = new Date().toISOString();
    // Giải phóng barcode để có thể tạo lại sản phẩm cùng mã.
    product.barcode = `${product.barcode}#deleted-${Date.now()}`;
    this.database.save();
    return { id: product.id, deleted: true };
  }

  private ensureUniqueBarcode(user: AuthUser, barcode: string) {
    if (this.active(user).some((product) => product.barcode === barcode)) {
      throw new ConflictException('Barcode đã tồn tại trong cửa hàng');
    }
  }

  private checkImage(user: AuthUser, imageUrl?: string): string | undefined {
    const value = imageUrl?.trim();
    if (!value) return undefined;
    if (!isOwnUploadPath(value, user.storeId)) {
      throw new BadRequestException('Ảnh sản phẩm phải được tải lên qua /uploads/image');
    }
    return value;
  }

  private generateCode(): string {
    return `SP${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  }
}
