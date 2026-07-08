'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const DEFAULT_GST_PERCENT = 5;
const MAX_ITEMS_PER_PAGE = 12;

const COL = {
  sr: 23,
  desc: 123,
  mfr: 74,
  hsn: 67,
  batch: 83,
  exp: 46,
  mrp: 39,
  qty: 28,
  gst: 32,
  amt: 52,
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8,
  },
  borderAll: { borderWidth: 1, borderColor: '#000' },
  borderTop: { borderTopWidth: 1, borderColor: '#000' },
  borderBottom: { borderBottomWidth: 1, borderColor: '#000' },
  borderRight: { borderRightWidth: 1, borderColor: '#000' },
  flexRow: { flexDirection: 'row' },
  p2: { padding: 3 },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  uppercase: { textTransform: 'uppercase' },
  textLg: { fontSize: 10, fontWeight: 'bold' },
  textXl: { fontSize: 11, fontWeight: 'bold' },
  // A5 landscape is 210×148 mm — same width as A4 portrait, half its height.
  a5Slot: {
    height: '46%',
    width: '100%',
    justifyContent: 'flex-start',
  },
  container: {
    flexDirection: 'column',
  },
  tableSection: {
    flexShrink: 0,
  },
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
    alignItems: 'flex-start',
  },
  cell: {
    borderRightWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  cellLast: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  cellText: {
    fontSize: 7.5,
  },
  totalsPanel: {
    width: COL.qty + COL.gst + COL.amt,
    flexShrink: 0,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
});

function Cell({
  width,
  children,
  align = 'left',
  last = false,
  uppercase = false,
}: {
  width: number;
  children: string | number;
  align?: 'left' | 'center' | 'right';
  last?: boolean;
  uppercase?: boolean;
}) {
  return (
    <View style={[last ? styles.cellLast : styles.cell, { width }]}>
      <Text
        style={[
          styles.cellText,
          ...(uppercase ? [styles.uppercase] : []),
          ...(align === 'center' ? [styles.textCenter] : align === 'right' ? [styles.textRight] : []),
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function InvoicePDF({ invoice, storeInfo, words, totalQty, roundOff, netAmount }: any) {
  const dateObj = new Date(invoice.invoiceDate || invoice.createdAt || Date.now());
  const invoiceDate = isNaN(dateObj.getTime())
    ? 'N/A'
    : dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
  const itemChunks: any[][] = [];
  for (let i = 0; i < invoice.items.length; i += MAX_ITEMS_PER_PAGE) {
    itemChunks.push(invoice.items.slice(i, i + MAX_ITEMS_PER_PAGE));
  }
  if (itemChunks.length === 0) {
    itemChunks.push([]);
  }

  return (
    <Document>
      {itemChunks.map((pageItems, pageIndex) => {
        const totalPages = itemChunks.length;
        const isLastPage = pageIndex === totalPages - 1;
        const serialOffset = pageIndex * MAX_ITEMS_PER_PAGE;

        return (
          <Page key={`invoice-page-${pageIndex}`} size="A4" orientation="portrait" style={styles.page} wrap>
            <View style={styles.a5Slot}>
              <View style={[styles.borderAll, styles.container]}>
                {/* Header Row 1 */}
                <View style={[styles.flexRow, styles.borderBottom]} wrap={false}>
                  <View style={[styles.p2, styles.borderRight, { width: '42%' }]}>
                    <Text style={[styles.textXl, styles.uppercase]}>{storeInfo?.name || 'MEDICAL STORE'}</Text>
                    <Text style={[styles.uppercase, { marginTop: 2, fontSize: 7 }]}>{storeInfo?.address || 'ADDRESS NOT PROVIDED'}</Text>
                    <Text style={{ marginTop: 2, fontWeight: 'bold', fontSize: 7.5 }}>MO. {storeInfo?.phone || 'N/A'}</Text>
                  </View>
                  <View style={[styles.p2, styles.borderRight, { width: '23%', justifyContent: 'center' }]}>
                    <Text style={[styles.uppercase, styles.bold, { fontSize: 10 }]}>TAX INVOICE</Text>
                    <Text style={[styles.bold, { marginTop: 6, fontSize: 7.5 }]}>ORIGINAL</Text>
                  </View>
                  <View style={[styles.p2, { width: '35%', justifyContent: 'center' }]}>
                    <Text style={{ fontWeight: 'bold', fontSize: 7.5 }}>D.L NO.</Text>
                    <Text style={{ marginTop: 1, fontSize: 7.5 }}>{storeInfo?.dl_no || '20 G SUR 71645/21 G SUR 71646'}</Text>
                    {(storeInfo?.gstin || '24AUZPP2770P1ZK') && (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 7.5 }}>GSTIN:</Text>
                        <Text style={{ marginTop: 1, fontSize: 7.5 }}>{storeInfo?.gstin || '24AUZPP2770P1ZK'}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Header Row 2 */}
                <View style={[styles.flexRow, styles.borderBottom]} wrap={false}>
                  <View style={[styles.p2, styles.borderRight, { width: '42%' }]}>
                    <View style={styles.flexRow}>
                      <Text style={{ width: 46, fontSize: 7.5 }}>Customer</Text>
                      <Text style={[styles.uppercase, { flex: 1, fontSize: 7.5 }]}>: {invoice.customerName || 'WALK-IN CUSTOMER'}</Text>
                    </View>
                    <View style={[styles.flexRow, { marginTop: 2 }]}>
                      <Text style={{ width: 46, fontSize: 7.5 }}>Doctor</Text>
                      <Text style={[styles.uppercase, { flex: 1, fontSize: 7.5 }]}>: {invoice.doctorName || 'WALK-IN'}</Text>
                    </View>
                  </View>
                  <View style={[styles.p2, styles.borderRight, { width: '23%' }]}>
                    <View style={styles.flexRow}>
                      <Text style={{ width: 26, fontSize: 7.5 }}>Area</Text>
                      <Text style={[styles.uppercase, { flex: 1, fontSize: 7.5 }]}>: {invoice.area || 'LOCAL'}</Text>
                    </View>
                    <View style={[styles.flexRow, { marginTop: 2 }]}>
                      <Text style={{ width: 26, fontSize: 7.5 }}>Mob</Text>
                      <Text style={{ flex: 1, fontSize: 7.5 }}>: {invoice.customerPhone || ' '}</Text>
                    </View>
                  </View>
                  <View style={[styles.p2, { width: '35%' }]}>
                    <View style={styles.flexRow}>
                      <Text style={{ width: 42, fontSize: 7.5 }}>Bill No</Text>
                      <Text style={[styles.bold, { flex: 1, fontSize: 7.5 }]}>: {invoice.invoiceNumber}</Text>
                    </View>
                    <View style={[styles.flexRow, { marginTop: 2 }]}>
                      <Text style={{ width: 42, fontSize: 7.5 }}>Date</Text>
                      <Text style={{ flex: 1, fontSize: 7.5 }}>: {invoiceDate}</Text>
                    </View>
                    <View style={[styles.flexRow, { marginTop: 2 }]}>
                      <Text style={{ width: 42, fontSize: 7.5 }}>Page</Text>
                      <Text style={{ flex: 1, fontSize: 7.5 }}>: {pageIndex + 1} of {totalPages}</Text>
                    </View>
                  </View>
                </View>

                {/* Table */}
                <View style={styles.tableSection}>
                  <View style={styles.tableHeaderRow} wrap={false}>
                    <Cell width={COL.sr} align="center">Sr.</Cell>
                    <Cell width={COL.desc}>Description</Cell>
                    <Cell width={COL.mfr}>MFG Name</Cell>
                    <Cell width={COL.hsn}>HSN</Cell>
                    <Cell width={COL.batch}>BatchNo</Cell>
                    <Cell width={COL.exp}>ExpDt</Cell>
                    <Cell width={COL.mrp} align="right">MRP</Cell>
                    <Cell width={COL.qty} align="right">Qty</Cell>
                    <Cell width={COL.gst} align="right">GST%</Cell>
                    <Cell width={COL.amt} align="right" last>Amount</Cell>
                  </View>

                  {pageItems.map((item: any, idx: number) => {
                    const amount = item.quantity * item.mrp;

                    const expDateObj = item.expiryDate ? new Date(item.expiryDate) : null;
                    const expDt =
                      expDateObj && !isNaN(expDateObj.getTime())
                        ? `${String(expDateObj.getMonth() + 1).padStart(2, '0')}-${expDateObj.getFullYear()}`
                        : ' ';

                    const hsn = item.medicine?.hsnCode || item.hsnCode || '30049099';

                    const gObj = item.medicine?.global_medicine_master;
                    const g = Array.isArray(gObj) ? gObj[0] || {} : gObj || {};
                    const medicineName = g.name || item.medicine?.name || item.medicineName || 'UNKNOWN';
                    const manufacturer = g.manufacturer || item.medicine?.manufacturer || item.manufacturer || ' ';

                    const batchNo = item.batchNumber || item.batch?.batch_number || ' ';

                    return (
                      <View key={`${pageIndex}-${idx}`} style={styles.tableRow} wrap={false}>
                        <Cell width={COL.sr} align="center">{serialOffset + idx + 1}</Cell>
                        <Cell width={COL.desc} uppercase>{medicineName}</Cell>
                        <Cell width={COL.mfr} uppercase>{manufacturer}</Cell>
                        <Cell width={COL.hsn}>{hsn}</Cell>
                        <Cell width={COL.batch} uppercase>{batchNo}</Cell>
                        <Cell width={COL.exp}>{expDt}</Cell>
                        <Cell width={COL.mrp} align="right">{item.mrp.toFixed(2)}</Cell>
                        <Cell width={COL.qty} align="right">{item.quantity}</Cell>
                        <Cell width={COL.gst} align="right">{`${DEFAULT_GST_PERCENT}%`}</Cell>
                        <Cell width={COL.amt} align="right" last>{amount.toFixed(2)}</Cell>
                      </View>
                    );
                  })}
                </View>

                {/* Footer */}
                {isLastPage ? (
                  <View style={[styles.flexRow, styles.borderTop]} wrap={false}>
                    <View style={[styles.p2, styles.borderRight, { flex: 1, justifyContent: 'flex-end' }]}>
                      <Text style={{ fontSize: 7.5 }}>Rupees {words} Only</Text>
                    </View>
                    <View style={styles.totalsPanel}>
                      <View style={styles.totalsRow}>
                        <Text style={[styles.bold, { fontSize: 7.5 }]}>TOTAL</Text>
                        <Text style={[styles.bold, { fontSize: 7.5, width: COL.qty, textAlign: 'right' }]}>{totalQty}</Text>
                        <Text style={[styles.bold, { fontSize: 7.5, width: COL.amt, textAlign: 'right' }]}>{invoice.subtotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.totalsRow}>
                        <Text style={{ fontSize: 7.5 }}>DISCOUNT</Text>
                        <Text style={{ fontSize: 7.5, width: COL.amt, textAlign: 'right' }}>
                          {invoice.discountAmount ? invoice.discountAmount.toFixed(2) : '0.00'}
                        </Text>
                      </View>
                      <View style={styles.totalsRow}>
                        <Text style={{ fontSize: 7.5 }}>ROUND OFF</Text>
                        <Text style={{ fontSize: 7.5, width: COL.amt, textAlign: 'right' }}>{roundOff}</Text>
                      </View>
                      <View style={[styles.totalsRow, { borderBottomWidth: 0, backgroundColor: '#f8fafc' }]}>
                        <Text style={styles.textLg}>NET</Text>
                        <Text style={[styles.textLg, { width: COL.amt, textAlign: 'right' }]}>{netAmount.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.flexRow, styles.borderTop]} wrap={false}>
                    <View style={[styles.p2, { width: '100%' }]}>
                      <Text style={[styles.textRight, { fontSize: 7.5 }]}>Continued on next page...</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
