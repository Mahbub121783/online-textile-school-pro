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
      { key: 'avatar_url', label: 'Profile Picture', weight: 12, completed: !!profile.avatar_url },
      { key: 'full_name', label: 'Full Name', weight: 12, completed: !!profile.full_name },
      { key: 'phone', label: 'Phone Number', weight: 12, completed: !!profile.phone },
      { key: 'blood_group', label: 'Blood Group', weight: 8, completed: !!profile.blood_group },
      { key: 'university', label: 'University/Institution', weight: 8, completed: !!profile.university },
      { key: 'batch', label: 'Batch', weight: 8, completed: !!profile.batch },
      { key: 'district', label: 'District', weight: 5, completed: !!profile.district },
      { key: 'professional_role', label: 'Current Role', weight: 8, completed: !!profile.professional_role },
      { key: 'date_of_birth', label: 'Date of Birth', weight: 5, completed: !!profile.date_of_birth },
      { key: 'preferred_language', label: 'Language Preference', weight: 5, completed: !!profile.preferred_language },
      { key: 'conditional', label: 'Role Details', weight: 5, completed: profile.professional_role === 'student' || (profile.professional_role === 'employee' && !!profile.company_name && !!profile.occupation) || (profile.professional_role === 'businessman' && !!profile.business_type) || !profile.professional_role },
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
