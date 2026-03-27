import { useAuth } from '@/hooks/useAuth';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Award, Wallet, Settings, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import UtilityBar from '@/components/layout/UtilityBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, profile, roles, signOut, loading } = useAuth();
  const { percentage, isComplete, incomplete } = useProfileCompleteness(profile);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth/login');
    return null;
  }

  const stats = [
    { label: 'Enrolled Courses', value: '0', icon: BookOpen },
    { label: 'Certificates', value: '0', icon: Award },
    { label: 'Wallet Balance', value: '৳0', icon: Wallet },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <UtilityBar /><Header />
      <main className="flex-1 pb-14 lg:pb-0">
        <div className="bg-primary text-primary-foreground py-8">
          <div className="container flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center text-2xl font-heading font-bold overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">{profile?.full_name || 'Student'}</h1>
              <p className="text-sm text-primary-foreground/70">{user.email}</p>
              {profile?.roll_id && <p className="text-xs text-primary-foreground/50">Roll ID: {profile.roll_id}</p>}
            </div>
          </div>
        </div>

        <div className="container py-6">
          {/* Profile Completeness */}
          <div className={`rounded-xl p-5 mb-6 ${isComplete ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'}`}>
            <div className="flex items-center gap-3 mb-2">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-heading font-bold text-sm">Profile {percentage}% Complete</span>
            </div>
            <Progress value={percentage} className="h-2 mb-2" />
            {!isComplete && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">Missing: {incomplete.map(f => f.label).join(', ')}</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')}>Complete Now</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-card border rounded-lg p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-heading text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-heading text-lg font-bold mb-4">Continue Learning</h2>
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted" />
              <p>You haven't enrolled in any courses yet.</p>
              <Button className="mt-4 bg-accent hover:bg-accent-hover text-accent-foreground" onClick={() => navigate('/courses')}>Browse Courses</Button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => navigate('/dashboard/settings')}><Settings className="h-4 w-4 mr-2" />Settings</Button>
            <Button variant="ghost" className="text-destructive" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
          </div>
        </div>
      </main>
      <Footer /><BottomNav />
    </div>
  );
};

export default Profile;
