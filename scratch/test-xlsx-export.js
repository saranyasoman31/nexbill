import * as XLSX from 'xlsx';
import fs from 'fs';

try {
  const wb = XLSX.utils.book_new();
  const data = [
    { 'SKU': 'SKU-001', 'Product Name': 'Basmati Rice 5kg', 'Category': 'Grocery', 'Stock': 45, 'Price': 450 },
    { 'SKU': 'SKU-002', 'Product Name': 'Sunflower Oil 1L', 'Category': 'Grocery', 'Stock': 120, 'Price': 140 },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync('scratch/test-output.xlsx', buffer);
  console.log('Excel generated successfully, size:', buffer.byteLength);
} catch (e) {
  console.error('Error generating Excel:', e);
}
