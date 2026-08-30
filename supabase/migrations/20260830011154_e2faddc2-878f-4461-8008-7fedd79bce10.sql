-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remove demo data
DELETE FROM public.study_sessions;
DELETE FROM public.subjects;

-- Ownership required
ALTER TABLE public.subjects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.subjects ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.study_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.study_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP INDEX IF EXISTS public.subjects_user_name_unique;
CREATE UNIQUE INDEX subjects_user_name_unique ON public.subjects (user_id, lower(btrim(name)));

-- Policies
DROP POLICY IF EXISTS subjects_public_all ON public.subjects;
DROP POLICY IF EXISTS study_sessions_public_all ON public.study_sessions;

REVOKE ALL ON public.subjects FROM anon;
REVOKE ALL ON public.study_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO authenticated;
GRANT ALL ON public.subjects TO service_role;
GRANT ALL ON public.study_sessions TO service_role;

CREATE POLICY "subjects_own" ON public.subjects FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_sessions_own" ON public.study_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);