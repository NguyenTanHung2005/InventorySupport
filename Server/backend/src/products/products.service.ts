import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthUser, Product } from '../common/types.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly database: DatabaseService) {}

  list(user: AuthUser): Product[] {
    return this.database.products.filter((product) => product.storeId === user.storeId);
  }

  findById(id: string, user: AuthUser): Product {
    const product = this.database.products.find(
      (candidate) => candidate.id === id && candidate.storeId === user.storeId,
    );
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return product;
  }

  findByBarcode(barcode: string, user: AuthUser): Product {
    const product = this.database.products.find(
      (candidate) =>
        candidate.barcode === barcode && candidate.storeId === user.storeId,
    );
    if (!product) throw new NotFoundException('Mã barcode chưa tồn tại');
    return product;
  }

  create(dto: CreateProductDto, user: AuthUser): Product {
    if (!dto.name.trim() || !dto.barcode.trim()) {
      throw new BadRequestException('Tên và barcode là bắt buộc');
    }
    if (this.database.products.some(
      (product) => product.storeId === user.storeId && product.barcode === dto.barcode,
    )) {
      throw new ConflictException('Barcode đã tồn tại trong cửa hàng');
    }
    const now = new Date().toISOString();
    const product: Product = {
      id: this.database.createId('product'),
      storeId: user.storeId,
      barcode: dto.barcode.trim(),
      name: dto.name.trim(),
      normalizedName: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      category: dto.category?.trim() || 'Khác',
      unit: dto.unit?.trim() || 'cái',
      price: Number(dto.price) || 0,
      minStock: Number(dto.minStock) || 0,
      imageUrl: dto.imageUrl,
      quantity: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.database.products.push(product);
    return product;
  }
}
