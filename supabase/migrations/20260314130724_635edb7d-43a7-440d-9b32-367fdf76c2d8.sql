DROP POLICY "Users can view their own equipment" ON public.equipment;
CREATE POLICY "All authenticated users can view equipment"
  ON public.equipment FOR SELECT TO authenticated USING (true);