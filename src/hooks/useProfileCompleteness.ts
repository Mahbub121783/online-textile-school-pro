import { useMemo } from 'react';

export interface ProfileField {
  key: string;
  label: string;
  weight: number;
  completed: boolean;
}

export const useProfileCompleteness = (profile: any) => {
  const fields: ProfileField[] = useMemo(() => {
    if (!profile) return [];
    return [
      { key: 'avatar_url', label: 'Profile Picture', weight: 10, completed: !!profile.avatar_url },
      { key: 'full_name', label: 'Full Name', weight: 8, completed: !!profile.full_name },
      { key: 'username', label: 'Username', weight: 6, completed: !!profile.username },
      { key: 'phone', label: 'Phone Number', weight: 8, completed: !!profile.phone },
      { key: 'blood_group', label: 'Blood Group', weight: 5, completed: !!profile.blood_group },
      { key: 'gender', label: 'Gender', weight: 4, completed: !!profile.gender },
      { key: 'university', label: 'University/Institution', weight: 6, completed: !!profile.university },
      { key: 'campus', label: 'Campus', weight: 4, completed: !!profile.campus },
      { key: 'batch', label: 'Batch', weight: 6, completed: !!profile.batch },
      { key: 'district', label: 'District', weight: 4, completed: !!profile.district },
      { key: 'upazila', label: 'Upazila', weight: 4, completed: !!profile.upazila },
      { key: 'professional_role', label: 'Current Role', weight: 6, completed: !!profile.professional_role },
      { key: 'date_of_birth', label: 'Date of Birth', weight: 4, completed: !!profile.date_of_birth },
      { key: 'preferred_language', label: 'Language Preference', weight: 3, completed: !!profile.preferred_language },
      { key: 'headline', label: 'Public Headline', weight: 4, completed: !!profile.headline },
      { key: 'bio', label: 'Bio', weight: 4, completed: !!profile.bio && profile.bio.length > 20 },
      { key: 'emergency_contact', label: 'Emergency Contact', weight: 4, completed: !!profile.emergency_contact },
      { key: 'location', label: 'Location Captured', weight: 3, completed: !!profile.latitude && !!profile.longitude },
      { key: 'social', label: 'A Social Link', weight: 4, completed: !!(profile.linkedin_url || profile.facebook_url || profile.github_url || profile.website_url) },
      { key: 'conditional', label: 'Role Details', weight: 3, completed: profile.professional_role === 'student' || (profile.professional_role === 'employee' && !!profile.company_name && !!profile.occupation) || (profile.professional_role === 'businessman' && !!profile.business_type) || !profile.professional_role },
    ];
  }, [profile]);

  const percentage = useMemo(() => {
    if (!profile) return 0;
    const total = fields.reduce((sum, f) => sum + f.weight, 0);
    const completed = fields.filter(f => f.completed).reduce((sum, f) => sum + f.weight, 0);
    return Math.round((completed / total) * 100);
  }, [fields, profile]);

  const incomplete = fields.filter(f => !f.completed);
  const isComplete = percentage === 100;

  return { fields, percentage, incomplete, isComplete };
};
