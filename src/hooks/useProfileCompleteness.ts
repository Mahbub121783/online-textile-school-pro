import { useMemo } from 'react';

export interface ProfileField {
  key: string;
  label: string;
  weight: number;
  completed: boolean;
}

/**
 * Profile completeness — only counts fields the user actually controls.
 * Public Profile (headline/bio) and Social Links are intentionally excluded
 * — they are optional and shouldn't block 100% completion.
 * Designation/Company/Business fields only count for non-student roles.
 */
export const useProfileCompleteness = (profile: any) => {
  const fields: ProfileField[] = useMemo(() => {
    if (!profile) return [];
    const role = profile.professional_role;

    const base: ProfileField[] = [
      { key: 'avatar_url', label: 'Profile Picture', weight: 10, completed: !!profile.avatar_url },
      { key: 'full_name', label: 'Full Name', weight: 8, completed: !!profile.full_name },
      { key: 'username', label: 'Username', weight: 6, completed: !!profile.username },
      { key: 'phone', label: 'Phone Number', weight: 8, completed: !!profile.phone },
      { key: 'whatsapp_number', label: 'WhatsApp Number', weight: 4, completed: !!profile.whatsapp_number },
      { key: 'date_of_birth', label: 'Date of Birth', weight: 4, completed: !!profile.date_of_birth },
      { key: 'gender', label: 'Gender', weight: 4, completed: !!profile.gender },
      { key: 'blood_group', label: 'Blood Group', weight: 4, completed: !!profile.blood_group },
      { key: 'district', label: 'District', weight: 4, completed: !!profile.district },
      { key: 'upazila', label: 'Upazila', weight: 4, completed: !!profile.upazila },
      { key: 'university', label: 'University/Institution', weight: 6, completed: !!profile.university },
      { key: 'department', label: 'Department', weight: 4, completed: !!((profile as any).department || profile.campus) },
      { key: 'batch', label: 'Batch', weight: 6, completed: !!profile.batch },
      { key: 'professional_role', label: 'Current Role', weight: 6, completed: !!role },
    ];

    // Role-specific fields only when relevant
    if (role === 'employee') {
      base.push(
        { key: 'occupation', label: 'Designation', weight: 4, completed: !!profile.occupation },
        { key: 'company_name', label: 'Company Name', weight: 4, completed: !!profile.company_name },
      );
    } else if (role === 'businessman') {
      base.push(
        { key: 'business_type', label: 'Business Type', weight: 4, completed: !!profile.business_type },
      );
    }

    return base;
  }, [profile]);

  const percentage = useMemo(() => {
    if (!profile || fields.length === 0) return 0;
    const total = fields.reduce((sum, f) => sum + f.weight, 0);
    const completed = fields.filter(f => f.completed).reduce((sum, f) => sum + f.weight, 0);
    return Math.round((completed / total) * 100);
  }, [fields, profile]);

  const incomplete = fields.filter(f => !f.completed);
  const isComplete = percentage === 100;

  return { fields, percentage, incomplete, isComplete };
};
