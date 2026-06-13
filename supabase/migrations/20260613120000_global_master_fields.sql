-- Migration: Global Master Fields
-- Adds advanced pharmacy fields to global_medicine_master

ALTER TABLE global_medicine_master ADD COLUMN pack_size varchar(50);
ALTER TABLE global_medicine_master ADD COLUMN uom varchar(50);
ALTER TABLE global_medicine_master ADD COLUMN ingredients jsonb DEFAULT '[]'::jsonb;
ALTER TABLE global_medicine_master ADD COLUMN substitutes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE global_medicine_master ADD COLUMN storage_conditions varchar(255);
ALTER TABLE global_medicine_master ADD COLUMN is_narcotic boolean DEFAULT false;
ALTER TABLE global_medicine_master ADD COLUMN prescription_required boolean DEFAULT false;
ALTER TABLE global_medicine_master ADD COLUMN barcode varchar(100);
ALTER TABLE global_medicine_master ADD COLUMN image_url text;
