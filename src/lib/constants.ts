export const COURSE_CATEGORIES = [
  { name: 'Spinning', slug: 'spinning', icon: '🧵' },
  { name: 'Weaving', slug: 'weaving', icon: '🪡' },
  { name: 'Dyeing & Finishing', slug: 'dyeing-finishing', icon: '🎨' },
  { name: 'Knitting', slug: 'knitting', icon: '🧶' },
  { name: 'Garments Technology', slug: 'garments-technology', icon: '👔' },
  { name: 'Quality Control', slug: 'quality-control', icon: '✅' },
  { name: 'Textile Management', slug: 'textile-management', icon: '📊' },
  { name: 'Yarn Technology', slug: 'yarn-technology', icon: '🧵' },
  { name: 'Merchandising', slug: 'merchandising', icon: '🏷️' },
  { name: 'CAD/CAM', slug: 'cad-cam', icon: '💻' },
] as const;

export const SITE_CONFIG = {
  name: 'Online Textile School',
  tagline: 'Learn Textile Engineering Online',
  phone: '+8801721001923',
  email: 'info@onlinetextileschool.com',
  whatsapp: '+8801721001923',
  social: {
    facebook: 'https://facebook.com/onlinetextileschool',
    youtube: 'https://youtube.com/@onlinetextileschool',
    linkedin: 'https://linkedin.com/company/onlinetextileschool',
  },
} as const;

export const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const BD_DISTRICTS = [
  'Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Barisal', 'Sylhet', 'Rangpur', 'Mymensingh',
  'Comilla', 'Gazipur', 'Narayanganj', 'Tangail', 'Narsingdi', 'Manikganj', 'Munshiganj',
  'Faridpur', 'Gopalganj', 'Madaripur', 'Shariatpur', 'Brahmanbaria', 'Chandpur', 'Feni',
  'Lakshmipur', 'Noakhali', 'Cox\'s Bazar', 'Bandarban', 'Khagrachari', 'Rangamati',
] as const;
