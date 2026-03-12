
-- Create equipment table
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  equipment_model text NOT NULL,
  tractor_model text DEFAULT '',
  fleet_number text NOT NULL,
  total_nozzles integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fleet_number)
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own equipment" ON public.equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own equipment" ON public.equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own equipment" ON public.equipment FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own equipment" ON public.equipment FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create registered_products table
CREATE TABLE public.registered_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  commercial_name text NOT NULL,
  formulation text NOT NULL,
  unit text NOT NULL,
  package_size numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registered_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own registered_products" ON public.registered_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own registered_products" ON public.registered_products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own registered_products" ON public.registered_products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own registered_products" ON public.registered_products FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_registered_products_updated_at BEFORE UPDATE ON public.registered_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
