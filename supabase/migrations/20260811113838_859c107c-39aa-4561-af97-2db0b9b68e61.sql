CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ sports catalog ============
CREATE TABLE public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  gps_based boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO anon, authenticated;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sports readable by everyone" ON public.sports FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.sports (slug, name, icon, gps_based, sort_order) VALUES
  ('musculacao','Musculação','dumbbell',false,1),
  ('corrida','Corrida','footprints',true,2),
  ('ciclismo','Ciclismo','bike',true,3),
  ('crossfit','CrossFit','flame',false,4),
  ('beach-tennis','Beach Tennis','circle-dot',false,5),
  ('natacao','Natação','waves',false,6),
  ('artes-marciais','Artes Marciais','swords',false,7),
  ('futebol','Futebol','goal',false,8),
  ('volei','Vôlei','volleyball',false,9),
  ('basquete','Basquete','dribbble',false,10),
  ('caminhada','Caminhada','footprints',true,11),
  ('trilha','Trilha','mountain',true,12),
  ('funcional','Funcional','activity',false,13),
  ('outro','Outro','plus',false,99);

-- ============ reserved usernames ============
CREATE TABLE public.reserved_usernames (
  username text PRIMARY KEY
);
GRANT SELECT ON public.reserved_usernames TO authenticated;
GRANT ALL ON public.reserved_usernames TO service_role;
ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reserved readable" ON public.reserved_usernames FOR SELECT TO authenticated USING (true);
INSERT INTO public.reserved_usernames (username) VALUES
  ('admin'),('administrador'),('evomatch'),('evo'),('suporte'),('support'),('root'),('sistema'),
  ('system'),('moderador'),('moderator'),('api'),('null'),('undefined'),('oficial'),('official'),
  ('help'),('ajuda'),('sobre'),('about'),('login'),('signup'),('cadastro'),('perfil'),('profile'),
  ('settings'),('config'),('explorar'),('explore'),('home'),('feed'),('chat'),('me'),('you');

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  cover_url text,
  city text,
  region text,
  country text DEFAULT 'BR',
  location geography(Point,4326),
  location_precision text NOT NULL DEFAULT 'approximate'
    CHECK (location_precision IN ('exact','approximate','city','none')),
  primary_sport_id uuid REFERENCES public.sports(id),
  goal text,
  experience_level text CHECK (experience_level IN ('iniciante','intermediario','avancado','atleta')),
  intent text[] NOT NULL DEFAULT '{}',
  weekly_frequency int CHECK (weekly_frequency BETWEEN 0 AND 21),
  available_days int[] NOT NULL DEFAULT '{}',
  available_periods text[] NOT NULL DEFAULT '{}',
  training_intensity text CHECK (training_intensity IN ('recreativo','moderado','consistente','performance','competitivo')),
  max_distance_km int NOT NULL DEFAULT 10 CHECK (max_distance_km BETWEEN 1 AND 200),
  training_places text[] NOT NULL DEFAULT '{}',
  profile_visibility text NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public','followers','connections','my_team','private')),
  show_city boolean NOT NULL DEFAULT true,
  show_availability boolean NOT NULL DEFAULT true,
  show_activities boolean NOT NULL DEFAULT true,
  onboarding_step int NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  is_pro boolean NOT NULL DEFAULT false,
  status_message text,
  status_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (username_lower);
CREATE INDEX profiles_location_idx ON public.profiles USING gist (location);
CREATE INDEX profiles_primary_sport_idx ON public.profiles (primary_sport_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ blocks (needed by profile policies) ============
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own blocks" ON public.blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE POLICY "own profile full access" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "read other profiles unless blocked or private" ON public.profiles FOR SELECT TO authenticated
  USING (
    id <> auth.uid()
    AND profile_visibility <> 'private'
    AND NOT public.is_blocked_between(auth.uid(), id)
  );

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- username validation
CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username !~ '^[a-zA-Z0-9._]{3,24}$' THEN
    RAISE EXCEPTION 'Username inválido: use 3 a 24 caracteres (letras, números, ponto ou underline).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reserved_usernames WHERE username = lower(NEW.username)) THEN
    RAISE EXCEPTION 'Este username é reservado.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_validate_username BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username();

-- ============ user sports ============
CREATE TABLE public.user_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  priority int NOT NULL DEFAULT 0,
  level text CHECK (level IN ('iniciante','intermediario','avancado','atleta')),
  goal text,
  practicing_since_months int,
  weekly_frequency int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sport_id)
);
CREATE INDEX user_sports_sport_idx ON public.user_sports (sport_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sports TO authenticated;
GRANT ALL ON public.user_sports TO service_role;
ALTER TABLE public.user_sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own sports" ON public.user_sports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "read others sports unless blocked" ON public.user_sports FOR SELECT TO authenticated
  USING (user_id <> auth.uid() AND NOT public.is_blocked_between(auth.uid(), user_id));
CREATE TRIGGER user_sports_updated_at BEFORE UPDATE ON public.user_sports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ follows ============
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON public.follows (following_id);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read follows unless blocked" ON public.follows FOR SELECT TO authenticated
  USING (NOT public.is_blocked_between(auth.uid(), follower_id)
     AND NOT public.is_blocked_between(auth.uid(), following_id));
CREATE POLICY "create own follow" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() AND NOT public.is_blocked_between(auth.uid(), following_id));
CREATE POLICY "delete own follow" ON public.follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- ============ connections (bilateral) ============
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  message text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX connections_addressee_idx ON public.connections (addressee_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own connections" ON public.connections FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "request connection" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND NOT public.is_blocked_between(auth.uid(), addressee_id));
CREATE POLICY "respond to connection" ON public.connections FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY "remove connection" ON public.connections FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE TRIGGER connections_updated_at BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ discovery / distance helper ============
CREATE OR REPLACE FUNCTION public.discover_people(
  _max_km int DEFAULT 50,
  _sport_id uuid DEFAULT NULL,
  _limit int DEFAULT 30
)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text, city text,
  primary_sport_id uuid, experience_level text, distance_km numeric, shared_sports int
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH me AS (SELECT * FROM public.profiles WHERE id = auth.uid())
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         CASE WHEN p.show_city THEN p.city ELSE NULL END AS city,
         p.primary_sport_id, p.experience_level,
         CASE WHEN me.location IS NOT NULL AND p.location IS NOT NULL
              THEN round((ST_Distance(me.location, p.location)/1000)::numeric, 1)
              ELSE NULL END AS distance_km,
         (SELECT count(*)::int FROM public.user_sports us1
           JOIN public.user_sports us2 ON us1.sport_id = us2.sport_id
          WHERE us1.user_id = me.id AND us2.user_id = p.id) AS shared_sports
    FROM public.profiles p, me
   WHERE p.id <> me.id
     AND p.onboarding_completed
     AND p.profile_visibility <> 'private'
     AND NOT public.is_blocked_between(me.id, p.id)
     AND (_sport_id IS NULL OR EXISTS (
           SELECT 1 FROM public.user_sports us WHERE us.user_id = p.id AND us.sport_id = _sport_id))
     AND (me.location IS NULL OR p.location IS NULL
          OR ST_DWithin(me.location, p.location, _max_km * 1000))
   ORDER BY shared_sports DESC, distance_km NULLS LAST
   LIMIT _limit;
$$;