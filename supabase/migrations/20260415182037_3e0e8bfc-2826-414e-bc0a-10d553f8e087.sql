
CREATE TABLE sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  tier text DEFAULT 'silver' CHECK (tier IN ('platinum','gold','silver','bronze')),
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  click_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active sponsors" ON sponsors FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manage sponsors" ON sponsors FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TRIGGER update_sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
