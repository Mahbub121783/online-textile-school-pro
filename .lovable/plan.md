

# Workshop System Enhancements

## Changes Overview

### 1. Admin Workshop Form — Instructor Search (replace manual fields)
- Remove `instructor_name`, `instructor_bio`, `instructor_avatar` text fields
- Add an `instructor_id` UUID column to `workshops` table (FK to `user_profiles`)
- Add instructor search: query `user_roles` for instructors/admins → search `user_profiles` by name
- Display selected instructor's avatar and name automatically
- On the public detail page, resolve instructor info from the joined `user_profiles` record

### 2. Featured Image via MediaPickerModal
- Replace the `thumbnail_url` text input with a MediaPickerModal button (matching existing patterns)
- Show preview of selected image, allow clearing

### 3. Workshop Curriculum/Lessons (course plan)
- Add a new `workshop_lessons` table: `id`, `workshop_id` (FK), `title`, `description`, `content` (rich text), `sort_order`, `lesson_type` (lecture/practical/demo), timestamps
- Add a "Curriculum" tab in the admin dialog alongside Details and Sessions
- Admin can add/reorder/delete lessons with title + content
- Public detail page shows the curriculum list

### 4. Materials Upload via Cloudinary/R2
- Replace manual URL input for materials with MediaPickerModal integration
- Use `useFileUpload` hook (existing) which routes images to Cloudinary and files to R2
- Material entries store: `name`, `url`, `type`, `storage_source`

### 5. Registration Confirmation Email
- On successful workshop registration, send workshop details to registrant's email
- Use existing `send-smtp-email` edge function (project's own SMTP system, not Lovable transactional)
- Include: workshop title, date/time, meet link (if published/ongoing), registration number, materials info
- This matches the existing email pattern used throughout the project

### Database Migration
```sql
-- Add instructor_id to workshops
ALTER TABLE workshops ADD COLUMN instructor_id uuid REFERENCES user_profiles(id);

-- Workshop lessons table
CREATE TABLE workshop_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid REFERENCES workshops(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  lesson_type text DEFAULT 'lecture',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE workshop_lessons ENABLE ROW LEVEL SECURITY;
-- Public read, admin manage
CREATE POLICY "Public read workshop_lessons" ON workshop_lessons FOR SELECT USING (true);
CREATE POLICY "Admin manage workshop_lessons" ON workshop_lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
);
```

### Files to Edit
- **`AdminWorkshops.tsx`**: Instructor search dropdown, MediaPickerModal for thumbnail + materials, Curriculum tab
- **`WorkshopDetail.tsx`**: Join `user_profiles` via `instructor_id`, show curriculum section
- **`WorkshopsPage.tsx`**: Join instructor profile for display
- **`MyWorkshopsPage.tsx`**: Minor — show instructor from joined data
- **`WorkshopDetail.tsx` registration mutation**: After successful insert, invoke `send-smtp-email` with workshop confirmation template

### Email Content (sent via existing SMTP system)
Subject: `Workshop Registration Confirmed: {title}`
Body includes: title, date/time, meet link, registration number, materials count, reminder text.

