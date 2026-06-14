-- Enable read access to global_medicine_master for everyone
CREATE POLICY "Anyone can view global medicines"
ON global_medicine_master FOR SELECT USING (true);
