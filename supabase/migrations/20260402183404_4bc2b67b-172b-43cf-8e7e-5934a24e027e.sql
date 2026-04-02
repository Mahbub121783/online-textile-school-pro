CREATE POLICY "Students insert own id card"
  ON public.student_id_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students update own id card"
  ON public.student_id_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);