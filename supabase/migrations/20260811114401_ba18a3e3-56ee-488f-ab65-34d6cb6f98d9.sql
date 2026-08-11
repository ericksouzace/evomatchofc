CREATE OR REPLACE FUNCTION public.set_my_location(_lat double precision, _lng double precision, _precision text DEFAULT 'approximate')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.';
  END IF;
  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Coordenadas inválidas.';
  END IF;
  IF _precision NOT IN ('exact','approximate','city','none') THEN
    RAISE EXCEPTION 'Precisão inválida.';
  END IF;

  UPDATE public.profiles
     SET location = ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography,
         location_precision = _precision
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_my_location(double precision, double precision, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_location(double precision, double precision, text) TO authenticated;