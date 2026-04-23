-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
ADD COLUMN IF NOT EXISTS role text DEFAULT 'operador',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Update handle_new_user function to include new columns from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'company', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'operador'),
    'active'
  );
  RETURN NEW;
END;
$$;

-- Update RLS policies to allow management by master users
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Masters can update all profiles" ON public.profiles;
CREATE POLICY "Masters can update all profiles" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (
  (auth.uid() = id) OR 
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'master'
  ))
);
