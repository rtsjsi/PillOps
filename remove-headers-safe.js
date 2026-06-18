const fs = require('fs');

function processFile(file, regexList) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  for (const regex of regexList) {
    content = content.replace(regex, '');
  }
  fs.writeFileSync(file, content);
  console.log('Processed', file);
}

processFile('src/app/reports/purchases/page.tsx', [
  /<div>\s*<h1 className="text-3xl font-bold tracking-tight">Purchase Register<\/h1>\s*<p className="text-muted-foreground font-medium mt-1">View all your historical inward bills and distributor invoices\.<\/p>\s*<\/div>\s*/
]);

processFile('src/app/reports/sales/page.tsx', [
  /<div>\s*<h1 className="text-3xl font-bold tracking-tight">Sales Register<\/h1>\s*<p className="text-muted-foreground font-medium mt-1">View all your historical sales invoices\.<\/p>\s*<\/div>\s*/
]);

processFile('src/app/reports/page.tsx', [
  /<header className="flex flex-col gap-2">\s*<h1 className="text-3xl font-bold tracking-tight">Reports & Analytics<\/h1>\s*<p className="text-muted-foreground font-medium">Access your store registers and inventory reports\.<\/p>\s*<\/header>\s*/
]);

processFile('src/app/reports/inventory/page.tsx', [
  /<div>\s*<h1 className="text-3xl font-bold tracking-tight">On Hand Stock<\/h1>\s*<p className="text-muted-foreground font-medium mt-1">Live inventory snapshot and valuation\.<\/p>\s*<\/div>\s*/
]);

processFile('src/app/profile/page.tsx', [
  /<header>\s*<h1 className="text-3xl font-bold tracking-tight">My Profile<\/h1>\s*<\/header>\s*/
]);

processFile('src/app/purchases/manual/page.tsx', [
  /<h1 className="text-3xl font-bold tracking-tight">Manual Purchase Entry<\/h1>\s*/
]);

processFile('src/app/purchases/review/page.tsx', [
  /<h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">\s*Review Data\s*<Sparkles size=\{24\} className="text-primary animate-pulse" \/>\s*<\/h1>\s*/
]);

processFile('src/app/pos/page.tsx', [
  /<div className="flex items-center gap-4">\s*<h1 className="text-3xl font-bold tracking-tight">Sales<\/h1>\s*<\/div>\s*/
]);

processFile('src/app/pos/new/page.tsx', [
  /<h1 className="text-3xl font-bold tracking-tight">New Sale<\/h1>\s*/
]);

processFile('src/app/inventory/page.tsx', [
  /<div>\s*<h1 className="text-3xl font-bold tracking-tight">Inventory<\/h1>\s*<p className="text-muted-foreground">Monitor and manage your medicine stock levels\.<\/p>\s*<\/div>\s*/
]);

processFile('src/app/inventory/add-misc/page.tsx', [
  /<h1 className="text-3xl font-bold tracking-tight">Add Miscellaneous Stock<\/h1>\s*/
]);

processFile('src/app/expiry/page.tsx', [
  /<header className="flex justify-between items-center mb-8">\s*<div>\s*<h1 className="text-3xl font-bold tracking-tight">Expiry Radar<\/h1>\s*<p className="text-muted-foreground">Monitor and action items nearing expiration\.<\/p>\s*<\/div>\s*<\/header>\s*/
]);
