-- Create a function to force PostgREST schema reload and then drop it
CREATE OR REPLACE FUNCTION public.reload_schema()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

SELECT public.reload_schema();
