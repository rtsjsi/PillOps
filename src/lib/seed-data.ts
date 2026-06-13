import { Medicine, Invoice } from './types';
import { generateId } from './utils';

// Helpers to create dates relative to "now" for realistic demo
function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
}

export function getSeedData(): { medicines: Medicine[]; invoices: Invoice[] } {
  const now = new Date().toISOString();

  const medicines: Medicine[] = [
    {
      id: 'med-001', name: 'Paracetamol 500mg', genericName: 'Acetaminophen',
      category: 'Tablet', manufacturer: 'Cipla Ltd', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S1',
      batches: [
        { id: 'b-001a', batchNumber: 'CP-2401', quantity: 100, purchasePrice: 8, mrp: 12, expiryDate: monthsFromNow(14), receivedDate: monthsAgo(3) },
        { id: 'b-001b', batchNumber: 'CP-2390', quantity: 30, purchasePrice: 7.5, mrp: 11, expiryDate: monthsFromNow(0), receivedDate: monthsAgo(10) },
        { id: 'b-001c', batchNumber: 'CP-2415', quantity: 15, purchasePrice: 8, mrp: 12, expiryDate: monthsFromNow(1), receivedDate: monthsAgo(6) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-002', name: 'Azithromycin 500mg', genericName: 'Azithromycin',
      category: 'Tablet', manufacturer: 'Sun Pharma', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S2',
      batches: [
        { id: 'b-002a', batchNumber: 'SP-8801', quantity: 45, purchasePrice: 60, mrp: 85, expiryDate: monthsFromNow(18), receivedDate: monthsAgo(2) },
        { id: 'b-002b', batchNumber: 'SP-8795', quantity: 12, purchasePrice: 58, mrp: 82, expiryDate: monthsFromNow(8), receivedDate: monthsAgo(5) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-003', name: 'Amoxicillin 250mg', genericName: 'Amoxicillin',
      category: 'Capsule', manufacturer: 'Dr. Reddys', hsnCode: '30041020',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A2-S1',
      batches: [
        { id: 'b-003a', batchNumber: 'DR-5501', quantity: 5, purchasePrice: 35, mrp: 52, expiryDate: monthsFromNow(10), receivedDate: monthsAgo(4) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-004', name: 'Cetirizine 10mg', genericName: 'Cetirizine Hydrochloride',
      category: 'Tablet', manufacturer: 'Cipla Ltd', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S3',
      batches: [
        { id: 'b-004a', batchNumber: 'CP-7710', quantity: 200, purchasePrice: 3, mrp: 5, expiryDate: monthsFromNow(20), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-005', name: 'Benadryl Cough Syrup 100ml', genericName: 'Diphenhydramine',
      category: 'Syrup', manufacturer: 'Johnson & Johnson', hsnCode: '30049039',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'B1-S1',
      batches: [
        { id: 'b-005a', batchNumber: 'JJ-4401', quantity: 12, purchasePrice: 75, mrp: 110, expiryDate: monthsFromNow(12), receivedDate: monthsAgo(2) },
        { id: 'b-005b', batchNumber: 'JJ-4380', quantity: 6, purchasePrice: 72, mrp: 105, expiryDate: monthsFromNow(-1), receivedDate: monthsAgo(14) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-006', name: 'Insulin Glargine 100IU/ml', genericName: 'Insulin Glargine',
      category: 'Injection', manufacturer: 'Sanofi India', hsnCode: '30043020',
      schedule: 'H', gstPercent: 5, reorderLevel: 50, totalStock: 0, rack: 'C1-S1',
      batches: [
        { id: 'b-006a', batchNumber: 'SN-9901', quantity: 3, purchasePrice: 650, mrp: 890, expiryDate: monthsFromNow(2), receivedDate: monthsAgo(4) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-007', name: 'ORS Electral Sachet', genericName: 'Oral Rehydration Salts',
      category: 'Sachet', manufacturer: 'FDC Ltd', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'D1-S1',
      batches: [
        { id: 'b-007a', batchNumber: 'FD-1201', quantity: 500, purchasePrice: 12, mrp: 22, expiryDate: monthsFromNow(24), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-008', name: 'Metformin 500mg', genericName: 'Metformin Hydrochloride',
      category: 'Tablet', manufacturer: 'USV Pvt Ltd', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A2-S2',
      batches: [
        { id: 'b-008a', batchNumber: 'UV-3301', quantity: 50, purchasePrice: 6, mrp: 10, expiryDate: monthsFromNow(16), receivedDate: monthsAgo(2) },
        { id: 'b-008b', batchNumber: 'UV-3288', quantity: 30, purchasePrice: 5.5, mrp: 9, expiryDate: monthsFromNow(6), receivedDate: monthsAgo(7) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-009', name: 'Dolo 650mg', genericName: 'Paracetamol',
      category: 'Tablet', manufacturer: 'Micro Labs', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S1',
      batches: [
        { id: 'b-009a', batchNumber: 'ML-6601', quantity: 180, purchasePrice: 10, mrp: 15, expiryDate: monthsFromNow(15), receivedDate: monthsAgo(1) },
        { id: 'b-009b', batchNumber: 'ML-6590', quantity: 70, purchasePrice: 9.5, mrp: 14, expiryDate: monthsFromNow(5), receivedDate: monthsAgo(6) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-010', name: 'Pantoprazole 40mg', genericName: 'Pantoprazole Sodium',
      category: 'Tablet', manufacturer: 'Alkem Labs', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A2-S3',
      batches: [
        { id: 'b-010a', batchNumber: 'AL-2201', quantity: 40, purchasePrice: 25, mrp: 42, expiryDate: monthsFromNow(12), receivedDate: monthsAgo(3) },
        { id: 'b-010b', batchNumber: 'AL-2188', quantity: 20, purchasePrice: 24, mrp: 40, expiryDate: monthsFromNow(1), receivedDate: monthsAgo(9) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-011', name: 'Clopidogrel 75mg', genericName: 'Clopidogrel Bisulfate',
      category: 'Tablet', manufacturer: 'Torrent Pharma', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A3-S1',
      batches: [
        { id: 'b-011a', batchNumber: 'TP-4401', quantity: 60, purchasePrice: 18, mrp: 30, expiryDate: monthsFromNow(11), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-012', name: 'Omeprazole 20mg', genericName: 'Omeprazole',
      category: 'Capsule', manufacturer: 'Cipla Ltd', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A2-S1',
      batches: [
        { id: 'b-012a', batchNumber: 'CP-9901', quantity: 80, purchasePrice: 12, mrp: 22, expiryDate: monthsFromNow(13), receivedDate: monthsAgo(3) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-013', name: 'Betadine Ointment 20g', genericName: 'Povidone Iodine',
      category: 'Ointment', manufacturer: 'Win Medicare', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 18, reorderLevel: 50, totalStock: 0, rack: 'B2-S1',
      batches: [
        { id: 'b-013a', batchNumber: 'WM-1101', quantity: 25, purchasePrice: 40, mrp: 65, expiryDate: monthsFromNow(20), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-014', name: 'Ciprofloxacin Eye Drops', genericName: 'Ciprofloxacin',
      category: 'Drops', manufacturer: 'Alcon Labs', hsnCode: '30049019',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'B3-S1',
      batches: [
        { id: 'b-014a', batchNumber: 'AC-7701', quantity: 15, purchasePrice: 38, mrp: 58, expiryDate: monthsFromNow(9), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-015', name: 'Salbutamol Inhaler 100mcg', genericName: 'Salbutamol',
      category: 'Inhaler', manufacturer: 'Cipla Ltd', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'C2-S1',
      batches: [
        { id: 'b-015a', batchNumber: 'CP-3301', quantity: 8, purchasePrice: 90, mrp: 142, expiryDate: monthsFromNow(16), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-016', name: 'Atorvastatin 10mg', genericName: 'Atorvastatin Calcium',
      category: 'Tablet', manufacturer: 'Pfizer', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A3-S2',
      batches: [
        { id: 'b-016a', batchNumber: 'PF-5501', quantity: 90, purchasePrice: 15, mrp: 28, expiryDate: monthsFromNow(17), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-017', name: 'Losartan 50mg', genericName: 'Losartan Potassium',
      category: 'Tablet', manufacturer: 'Torrent Pharma', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A3-S3',
      batches: [
        { id: 'b-017a', batchNumber: 'TP-6601', quantity: 55, purchasePrice: 12, mrp: 22, expiryDate: monthsFromNow(14), receivedDate: monthsAgo(3) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-018', name: 'Montelukast 10mg', genericName: 'Montelukast Sodium',
      category: 'Tablet', manufacturer: 'Sun Pharma', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A4-S1',
      batches: [
        { id: 'b-018a', batchNumber: 'SP-2201', quantity: 40, purchasePrice: 30, mrp: 52, expiryDate: monthsFromNow(10), receivedDate: monthsAgo(4) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-019', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen',
      category: 'Tablet', manufacturer: 'Mankind Pharma', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S4',
      batches: [
        { id: 'b-019a', batchNumber: 'MK-7701', quantity: 120, purchasePrice: 5, mrp: 8, expiryDate: monthsFromNow(19), receivedDate: monthsAgo(1) },
        { id: 'b-019b', batchNumber: 'MK-7688', quantity: 4, purchasePrice: 4.5, mrp: 7, expiryDate: monthsFromNow(1), receivedDate: monthsAgo(11) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-020', name: 'Ranitidine 150mg', genericName: 'Ranitidine Hydrochloride',
      category: 'Tablet', manufacturer: 'GSK', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A2-S4',
      batches: [
        { id: 'b-020a', batchNumber: 'GK-1101', quantity: 35, purchasePrice: 8, mrp: 14, expiryDate: monthsFromNow(7), receivedDate: monthsAgo(5) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-021', name: 'Domperidone 10mg', genericName: 'Domperidone',
      category: 'Tablet', manufacturer: 'Dr. Reddys', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A4-S2',
      batches: [
        { id: 'b-021a', batchNumber: 'DR-8801', quantity: 70, purchasePrice: 6, mrp: 10, expiryDate: monthsFromNow(15), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-022', name: 'Vitamin D3 60000IU', genericName: 'Cholecalciferol',
      category: 'Sachet', manufacturer: 'USV Pvt Ltd', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'D1-S2',
      batches: [
        { id: 'b-022a', batchNumber: 'UV-1101', quantity: 45, purchasePrice: 25, mrp: 40, expiryDate: monthsFromNow(22), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-023', name: 'Diclofenac Gel 30g', genericName: 'Diclofenac Diethylamine',
      category: 'Ointment', manufacturer: 'Novartis', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 18, reorderLevel: 50, totalStock: 0, rack: 'B2-S2',
      batches: [
        { id: 'b-023a', batchNumber: 'NV-3301', quantity: 18, purchasePrice: 45, mrp: 72, expiryDate: monthsFromNow(13), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-024', name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate',
      category: 'Tablet', manufacturer: 'Pfizer', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A3-S4',
      batches: [
        { id: 'b-024a', batchNumber: 'PF-9901', quantity: 65, purchasePrice: 8, mrp: 14, expiryDate: monthsFromNow(18), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-025', name: 'Levocetirizine 5mg', genericName: 'Levocetirizine Dihydrochloride',
      category: 'Tablet', manufacturer: 'Glenmark', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A1-S5',
      batches: [
        { id: 'b-025a', batchNumber: 'GM-4401', quantity: 150, purchasePrice: 4, mrp: 7, expiryDate: monthsFromNow(16), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-026', name: 'Ondansetron 4mg', genericName: 'Ondansetron',
      category: 'Tablet', manufacturer: 'Sun Pharma', hsnCode: '30049099',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A4-S3',
      batches: [
        { id: 'b-026a', batchNumber: 'SP-5501', quantity: 2, purchasePrice: 20, mrp: 35, expiryDate: monthsFromNow(9), receivedDate: monthsAgo(3) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-027', name: 'Cefixime 200mg', genericName: 'Cefixime',
      category: 'Tablet', manufacturer: 'Mankind Pharma', hsnCode: '30041090',
      schedule: 'H', gstPercent: 12, reorderLevel: 50, totalStock: 0, rack: 'A5-S1',
      batches: [
        { id: 'b-027a', batchNumber: 'MK-2201', quantity: 30, purchasePrice: 45, mrp: 72, expiryDate: monthsFromNow(11), receivedDate: monthsAgo(3) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-028', name: 'Multivitamin Tablets', genericName: 'Multivitamin Complex',
      category: 'Tablet', manufacturer: 'Abbott', hsnCode: '21069099',
      schedule: 'OTC', gstPercent: 18, reorderLevel: 50, totalStock: 0, rack: 'D2-S1',
      batches: [
        { id: 'b-028a', batchNumber: 'AB-7701', quantity: 60, purchasePrice: 8, mrp: 15, expiryDate: monthsFromNow(20), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-029', name: 'Terbinafine Cream 15g', genericName: 'Terbinafine',
      category: 'Ointment', manufacturer: 'Glenmark', hsnCode: '30049099',
      schedule: 'OTC', gstPercent: 18, reorderLevel: 50, totalStock: 0, rack: 'B2-S3',
      batches: [
        { id: 'b-029a', batchNumber: 'GM-8801', quantity: 12, purchasePrice: 65, mrp: 105, expiryDate: monthsFromNow(15), receivedDate: monthsAgo(2) },
      ],
      createdAt: now, updatedAt: now,
    },
    {
      id: 'med-030', name: 'Calcium + Vitamin D3', genericName: 'Calcium Carbonate + Cholecalciferol',
      category: 'Tablet', manufacturer: 'Abbott', hsnCode: '21069099',
      schedule: 'OTC', gstPercent: 18, reorderLevel: 50, totalStock: 0, rack: 'D2-S2',
      batches: [
        { id: 'b-030a', batchNumber: 'AB-1101', quantity: 75, purchasePrice: 10, mrp: 18, expiryDate: monthsFromNow(22), receivedDate: monthsAgo(1) },
      ],
      createdAt: now, updatedAt: now,
    },
  ];

  // ─── Seed Invoices (recent sales) ────────────────────────

  const invoices: Invoice[] = [
    {
      id: generateId(),
      invoiceNumber: 'INV-20260420-001',
      items: [
        { medicineId: 'med-001', medicineName: 'Paracetamol 500mg', batchId: 'b-001a', batchNumber: 'CP-2401', quantity: 10, mrp: 12, gstPercent: 12, expiryDate: monthsFromNow(14) },
        { medicineId: 'med-004', medicineName: 'Cetirizine 10mg', batchId: 'b-004a', batchNumber: 'CP-7710', quantity: 5, mrp: 5, gstPercent: 12, expiryDate: monthsFromNow(20) },
      ],
      subtotal: 145,
      gstAmount: 17.40,
      discountPercent: 0,
      discountAmount: 0,
      total: 162.40,
      createdAt: daysAgo(0),
    },
    {
      id: generateId(),
      invoiceNumber: 'INV-20260420-002',
      items: [
        { medicineId: 'med-002', medicineName: 'Azithromycin 500mg', batchId: 'b-002a', batchNumber: 'SP-8801', quantity: 3, mrp: 85, gstPercent: 12, expiryDate: monthsFromNow(18) },
      ],
      subtotal: 255,
      gstAmount: 30.60,
      discountPercent: 5,
      discountAmount: 12.75,
      total: 272.85,
      createdAt: daysAgo(0),
    },
    {
      id: generateId(),
      invoiceNumber: 'INV-20260419-001',
      items: [
        { medicineId: 'med-009', medicineName: 'Dolo 650mg', batchId: 'b-009a', batchNumber: 'ML-6601', quantity: 20, mrp: 15, gstPercent: 12, expiryDate: monthsFromNow(15) },
        { medicineId: 'med-005', medicineName: 'Benadryl Cough Syrup 100ml', batchId: 'b-005a', batchNumber: 'JJ-4401', quantity: 1, mrp: 110, gstPercent: 12, expiryDate: monthsFromNow(12) },
        { medicineId: 'med-013', medicineName: 'Betadine Ointment 20g', batchId: 'b-013a', batchNumber: 'WM-1101', quantity: 2, mrp: 65, gstPercent: 18, expiryDate: monthsFromNow(20) },
      ],
      subtotal: 540,
      gstAmount: 59.40,
      discountPercent: 0,
      discountAmount: 0,
      total: 599.40,
      createdAt: daysAgo(1),
    },
    {
      id: generateId(),
      invoiceNumber: 'INV-20260418-001',
      items: [
        { medicineId: 'med-006', medicineName: 'Insulin Glargine 100IU/ml', batchId: 'b-006a', batchNumber: 'SN-9901', quantity: 1, mrp: 890, gstPercent: 5, expiryDate: monthsFromNow(2) },
      ],
      subtotal: 890,
      gstAmount: 44.50,
      discountPercent: 10,
      discountAmount: 89,
      total: 845.50,
      createdAt: daysAgo(2),
    },
    {
      id: generateId(),
      invoiceNumber: 'INV-20260417-001',
      items: [
        { medicineId: 'med-016', medicineName: 'Atorvastatin 10mg', batchId: 'b-016a', batchNumber: 'PF-5501', quantity: 30, mrp: 28, gstPercent: 12, expiryDate: monthsFromNow(17) },
        { medicineId: 'med-024', medicineName: 'Amlodipine 5mg', batchId: 'b-024a', batchNumber: 'PF-9901', quantity: 30, mrp: 14, gstPercent: 12, expiryDate: monthsFromNow(18) },
      ],
      subtotal: 1260,
      gstAmount: 151.20,
      discountPercent: 0,
      discountAmount: 0,
      total: 1411.20,
      createdAt: daysAgo(3),
    },
  ];

  return { medicines, invoices };
}
