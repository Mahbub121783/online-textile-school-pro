CREATE TABLE course_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE course_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors manage announcements" ON course_announcements
FOR ALL TO authenticated
USING (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (instructor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Students view announcements" ON course_announcements
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.course_id = course_announcements.course_id
  AND e.user_id = auth.uid()
));