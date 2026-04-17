import { Crown, Shield, Megaphone, PenTool, GraduationCap, User, LucideIcon } from 'lucide-react';

export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'chief_marketer'
  | 'content_writer'
  | 'instructor'
  | 'student';

export interface RoleDefinition {
  role: AppRole;
  label: string;
  description: string;
  icon: LucideIcon;
  badgeVariant: 'destructive' | 'default' | 'secondary' | 'outline';
  colorClass: string;
  requiresConfirm: boolean;
  level: number; // higher = more powerful
}

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full system access — manage everything including other admins.',
    icon: Crown,
    badgeVariant: 'destructive',
    colorClass: 'text-destructive',
    requiresConfirm: true,
    level: 100,
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'Manage users, courses, payments and platform settings.',
    icon: Shield,
    badgeVariant: 'default',
    colorClass: 'text-primary',
    requiresConfirm: true,
    level: 80,
  },
  chief_marketer: {
    role: 'chief_marketer',
    label: 'Chief Marketer',
    description: 'Manage campaigns, popups, coupons and marketing analytics.',
    icon: Megaphone,
    badgeVariant: 'secondary',
    colorClass: 'text-orange-500',
    requiresConfirm: false,
    level: 50,
  },
  content_writer: {
    role: 'content_writer',
    label: 'Content Writer',
    description: 'Create and publish blog posts and CMS pages.',
    icon: PenTool,
    badgeVariant: 'secondary',
    colorClass: 'text-blue-500',
    requiresConfirm: false,
    level: 40,
  },
  instructor: {
    role: 'instructor',
    label: 'Instructor',
    description: 'Create courses, lessons, quizzes and grade students.',
    icon: GraduationCap,
    badgeVariant: 'secondary',
    colorClass: 'text-emerald-500',
    requiresConfirm: false,
    level: 30,
  },
  student: {
    role: 'student',
    label: 'Student',
    description: 'Default role — enroll in courses and track progress.',
    icon: User,
    badgeVariant: 'outline',
    colorClass: 'text-muted-foreground',
    requiresConfirm: false,
    level: 10,
  },
};

export const ALL_ROLE_DEFS = Object.values(ROLE_DEFINITIONS).sort((a, b) => b.level - a.level);

export const getRoleDef = (role: string): RoleDefinition | undefined =>
  ROLE_DEFINITIONS[role as AppRole];
