# Profile Completeness 0% Bug — Fix Plan

## Bug

Sidebar widget এবং Student ID Card alert এ "Profile 0% complete. Missing: ." দেখাচ্ছে — অথচ DB তে user (OTS-386588) এর সব field পূরণ আছে (full_name, phone, DOB, gender, blood_group, district, upazila, university, department, batch, professional_role, avatar)। ID Card নিজেই সব data সঠিকভাবে render করছে।

## Root Cause

`useProfileCompleteness(profile)` এর শুরুতে:

```ts
if (!profile) return 0;          // percentage
const incomplete = fields.filter(...) // [] when fields=[]
```

যখন `profile === null` (auth এখনও load হয়নি, বা persisted cache খালি), hook return করে:
- `percentage: 0`
- `incomplete: []` → তাই "Missing: ." এ কিছুই নেই
- `isComplete: false` → তাই red alert দেখায়

ফলে loading state কে "0% incomplete" বলে দেখাচ্ছে। `StudentIdCard` `useAuth().profile` ব্যবহার করছে completeness এর জন্য, কিন্তু card render এর জন্য নিজের আলাদা `targetProfile` query চালাচ্ছে — তাই card data দেখা যাচ্ছে কিন্তু completeness wrong।

`DashboardSidebar` এর `ProfileCompletenessWidget` ও same useAuth profile এ depend করে, profile null থাকলে "Profile 0%" দেখায়।

## Fix (frontend only)

### 1. `src/hooks/useProfileCompleteness.ts`
- নতুন `isLoading` field যোগ করো: `isLoading = !profile`
- profile null হলে `percentage: 0, incomplete: [], isComplete: false, isLoading: true` return করো — consumers এর হাতে decision থাকবে।

### 2. `src/components/student/StudentIdCard.tsx`
- `useProfileCompleteness(profile)` এর জায়গায় `useProfileCompleteness(targetProfile)` ব্যবহার করো — যেটা card data এর সাথে consistent (same source)।
- `isLoading` হলে warning alert render skip করো।

### 3. `src/components/ProfileCompletenessWidget.tsx`
- `isLoading` true হলে কিছুই render করো না (return `null`) — যাতে "0%" flash না হয়।

### 4. `src/pages/Profile.tsx`
- Same pattern: `isLoading` হলে completeness card skip করো।

### 5. `src/pages/dashboard/CertificatesPage.tsx`
- Same defensive check।

## Validation

- Logged-in user এর dashboard load করে নিশ্চিত করো sidebar widget আর "Profile 0%" flash দেখায় না — সরাসরি actual percentage (এই user এর ক্ষেত্রে 100%) দেখায়।
- Student ID Card এ আর red "Missing: ." alert আসবে না।

## Out of Scope

- কোনো DB / RLS / migration change লাগবে না — data fine আছে, শুধুমাত্র frontend render guard issue।
