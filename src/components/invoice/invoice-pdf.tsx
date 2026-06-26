'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatExpiryDate } from '@/lib/utils';

const styles = StyleSheet.create({
  page: { 
    padding: 20, 
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 9,
  },
  tableCellHeader: { fontWeight: 'bold' },
  borderAll: { borderWidth: 1, borderColor: '#000' },
  borderTop: { borderTopWidth: 1, borderColor: '#000' },
  borderBottom: { borderBottomWidth: 1, borderColor: '#000' },
  borderRight: { borderRightWidth: 1, borderColor: '#000' },
  borderLeft: { borderLeftWidth: 1, borderColor: '#000' },
  flexRow: { flexDirection: 'row' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  p2: { padding: 4 },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  uppercase: { textTransform: 'uppercase' },
  textXs: { fontSize: 8 },
  textLg: { fontSize: 12, fontWeight: 'bold' },
  textXl: { fontSize: 14, fontWeight: 'bold' },
  
  // Table specifically
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f8fafc',
    paddingVertical: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
});

export function InvoicePDF({ invoice, storeInfo, words, totalQty, roundOff, netAmount }: any) {
  const dateObj = new Date(invoice.invoiceDate || invoice.createdAt || Date.now());
  const invoiceDate = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.borderAll}>
          
          {/* Header Row 1 */}
          <View style={[styles.flexRow, styles.borderBottom]}>
            <View style={[styles.p2, styles.borderRight, { width: '45%' }]}>
              <Text style={[styles.textXl, styles.uppercase]}>{storeInfo?.name || 'MEDICAL STORE'}</Text>
              <Text style={[styles.uppercase, { marginTop: 4 }]}>{storeInfo?.address || 'ADDRESS NOT PROVIDED'}</Text>
              <Text style={{ marginTop: 4, fontWeight: 'bold' }}>MO. {storeInfo?.phone || 'N/A'}</Text>
            </View>
            <View style={[styles.p2, styles.borderRight, { width: '25%', justifyContent: 'space-between' }]}>
              <Text style={[styles.uppercase, styles.bold, { fontSize: 11 }]}>TAX INVOICE</Text>
              <View style={[styles.flexRow, { justifyContent: 'space-between', marginTop: 10 }]}>
                <Text style={styles.bold}>ORIGINAL</Text>
              </View>
            </View>
            <View style={[styles.p2, { width: '30%', justifyContent: 'center' }]}>
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontWeight: 'bold' }}>D.L NO.</Text>
                <Text style={{ marginTop: 2 }}>{storeInfo?.dl_no || '20 G SUR 71645/21 G SUR 71646'}</Text>
              </View>
              {(storeInfo?.gstin || '24AUZPP2770P1ZK') && (
                <View>
                  <Text style={{ fontWeight: 'bold' }}>GSTIN:</Text>
                  <Text style={{ marginTop: 2 }}>{storeInfo?.gstin || '24AUZPP2770P1ZK'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Header Row 2 */}
          <View style={[styles.flexRow, styles.borderBottom]}>
            <View style={[styles.p2, styles.borderRight, { width: '45%' }]}>
              <View style={styles.flexRow}>
                <Text style={{ width: 50 }}>Customer</Text>
                <Text style={styles.uppercase}>: {invoice.customerName || 'WALK-IN CUSTOMER'}</Text>
              </View>
              <View style={[styles.flexRow, { marginTop: 2 }]}>
                <Text style={{ width: 50 }}>Doctor</Text>
                <Text style={styles.uppercase}>: {invoice.doctorName || 'WALK-IN'}</Text>
              </View>
            </View>
            <View style={[styles.p2, styles.borderRight, { width: '25%' }]}>
              <View style={styles.flexRow}>
                <Text style={{ width: 30 }}>Area</Text>
                <Text style={styles.uppercase}>: {invoice.area || 'LOCAL'}</Text>
              </View>
              <View style={[styles.flexRow, { marginTop: 2 }]}>
                <Text style={{ width: 30 }}>Mob</Text>
                <Text>: {invoice.customerPhone || ' '}</Text>
              </View>
            </View>
            <View style={[styles.p2, { width: '30%' }]}>
              <View style={styles.flexRow}>
                <Text style={{ width: 35 }}>Bill No</Text>
                <Text style={styles.bold}>: {invoice.invoiceNumber}</Text>
              </View>
              <View style={[styles.flexRow, { marginTop: 2 }]}>
                <Text style={{ width: 35 }}>Date</Text>
                <Text>: {invoiceDate}</Text>
              </View>
            </View>
          </View>

          {/* Table */}
          <View style={{ minHeight: 300 }}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.textCenter, styles.borderRight, { width: '5%' }]}>Sr.</Text>
              <Text style={[styles.borderRight, { width: '28%', paddingLeft: 2 }]}>Description</Text>
              <Text style={[styles.borderRight, { width: '15%', paddingLeft: 2 }]}>HSN</Text>
              <Text style={[styles.borderRight, { width: '18%', paddingLeft: 2 }]}>BatchNo</Text>
              <Text style={[styles.borderRight, { width: '10%', paddingLeft: 2 }]}>ExpDt</Text>
              <Text style={[styles.textRight, styles.borderRight, { width: '8%', paddingRight: 2 }]}>MRP</Text>
              <Text style={[styles.textRight, styles.borderRight, { width: '6%', paddingRight: 2 }]}>Qty</Text>
              <Text style={[styles.textRight, { width: '10%', paddingRight: 4 }]}>Amount</Text>
            </View>
            
            {invoice.items.map((item: any, idx: number) => {
              const amount = item.quantity * item.mrp;
              
              const expDateObj = item.expiryDate ? new Date(item.expiryDate) : null;
              const expDt = expDateObj && !isNaN(expDateObj.getTime()) 
                 ? `${String(expDateObj.getMonth() + 1).padStart(2, '0')}-${expDateObj.getFullYear()}` 
                 : ' ';
                 
              const hsn = item.medicine?.hsnCode || item.hsnCode || '30049099';
              
              const gObj = item.medicine?.global_medicine_master;
              const g = Array.isArray(gObj) ? (gObj[0] || {}) : (gObj || {});
              const medicineName = g.name || item.medicine?.name || item.medicineName || 'UNKNOWN';
              
              const batchNo = item.batchNumber || item.batch?.batch_number || ' ';
              
              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.textCenter, styles.borderRight, { width: '5%' }]}>{idx + 1}</Text>
                  <Text style={[styles.uppercase, styles.borderRight, { width: '28%', paddingLeft: 2 }]}>{medicineName}</Text>
                  <Text style={[styles.borderRight, { width: '15%', paddingLeft: 2 }]}>{hsn}</Text>
                  <Text style={[styles.uppercase, styles.borderRight, { width: '18%', paddingLeft: 2 }]}>{batchNo}</Text>
                  <Text style={[styles.borderRight, { width: '10%', paddingLeft: 2 }]}>{expDt}</Text>
                  <Text style={[styles.textRight, styles.borderRight, { width: '8%', paddingRight: 2 }]}>{item.mrp.toFixed(2)}</Text>
                  <Text style={[styles.textRight, styles.borderRight, { width: '6%', paddingRight: 2 }]}>{item.quantity}</Text>
                  <Text style={[styles.textRight, { width: '10%', paddingRight: 4 }]}>{amount.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>

          {/* Footer Area */}
          <View style={[styles.flexRow, styles.borderTop]}>
            <View style={[styles.flex3, styles.p2, styles.borderRight, { justifyContent: 'flex-end', paddingBottom: 4 }]}>
              <Text style={{ marginTop: 2 }}>Rupees {words} Only</Text>
            </View>
            <View style={styles.flex1}>
              <View style={[styles.flexRow, styles.borderBottom, styles.p2, { justifyContent: 'space-between' }]}>
                <Text style={styles.bold}>TOTAL</Text>
                <Text style={styles.bold}>{totalQty}</Text>
                <Text style={styles.bold}>{invoice.subtotal.toFixed(2)}</Text>
              </View>
              <View style={[styles.flexRow, styles.borderBottom, styles.p2, { justifyContent: 'space-between' }]}>
                <Text>DISCOUNT</Text>
                <Text>{invoice.discountAmount ? invoice.discountAmount.toFixed(2) : '0.00'}</Text>
              </View>
              <View style={[styles.flexRow, styles.borderBottom, styles.p2, { justifyContent: 'space-between' }]}>
                <Text>ROUND OFF</Text>
                <Text>{roundOff}</Text>
              </View>
              <View style={[styles.flexRow, styles.p2, { justifyContent: 'space-between', backgroundColor: '#f8fafc' }]}>
                <Text style={styles.textLg}>NET</Text>
                <Text style={styles.textLg}>{netAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
