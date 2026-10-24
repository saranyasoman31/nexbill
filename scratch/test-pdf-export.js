import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';

try {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text('NexBill ERP - Test Export', 14, 15);
  
  autoTable(doc, {
    head: [['ID', 'Name', 'Category', 'Stock']],
    body: [
      ['SKU-001', 'Basmati Rice 5kg', 'Grocery', '45'],
      ['SKU-002', 'Sunflower Oil 1L', 'Grocery', '120'],
      ['SKU-003', 'Amul Butter 500g', 'Dairy', '30']
    ],
    startY: 25
  });

  const arrayBuffer = doc.output('arraybuffer');
  fs.writeFileSync('scratch/test-output.pdf', Buffer.from(arrayBuffer));
  console.log('PDF generated successfully, size:', arrayBuffer.byteLength);
} catch (e) {
  console.error('Error generating PDF:', e);
}
