CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subjects_user_name_unique
  ON public.subjects (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

CREATE TABLE public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  session_date date NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  study_method text,
  study_method_other text,
  made_summary boolean NOT NULL DEFAULT false,
  made_review boolean NOT NULL DEFAULT false,
  practice_type text NOT NULL DEFAULT 'none' CHECK (practice_type IN ('none','questions','simulado')),
  questions_total integer CHECK (questions_total IS NULL OR questions_total > 0),
  questions_correct integer CHECK (questions_correct IS NULL OR questions_correct >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_fields_valid CHECK (
    (practice_type = 'none' AND questions_total IS NULL AND questions_correct IS NULL)
    OR (practice_type <> 'none' AND questions_total IS NOT NULL AND questions_correct IS NOT NULL AND questions_correct <= questions_total)
  )
);

CREATE INDEX study_sessions_subject_idx ON public.study_sessions (subject_id, session_date DESC);

CREATE OR REPLACE FUNCTION public.check_session_date_not_future()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.session_date > (now() AT TIME ZONE 'UTC')::date + 1 THEN
    RAISE EXCEPTION 'session_date cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER study_sessions_date_check
BEFORE INSERT OR UPDATE ON public.study_sessions
FOR EACH ROW EXECUTE FUNCTION public.check_session_date_not_future();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER study_sessions_updated_at
BEFORE UPDATE ON public.study_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO anon, authenticated;
GRANT ALL ON public.subjects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_sessions TO anon, authenticated;
GRANT ALL ON public.study_sessions TO service_role;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_public_all" ON public.subjects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "study_sessions_public_all" ON public.study_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.subjects (name, color) VALUES
  ('Português', '#6366f1'),
  ('Matemática', '#0ea5e9'),
  ('História', '#f59e0b'),
  ('Geografia', '#10b981'),
  ('Física', '#ef4444'),
  ('Química', '#8b5cf6'),
  ('Biologia', '#22c55e'),
  ('Inglês', '#ec4899'),
  ('Redação', '#14b8a6');