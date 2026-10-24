import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

console.log('XLSX loaded:', typeof XLSX.writeFile);
console.log('jsPDF loaded:', typeof jsPDF);
console.log('autoTable loaded:', typeof autoTable);
