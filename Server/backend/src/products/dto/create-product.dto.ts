export class CreateProductDto {
  barcode = '';
  name = '';
  description = '';
  category = 'Khác';
  unit = 'cái';
  price = 0;
  minStock = 0;
  imageUrl?: string;
}
