import { createContext, useContext, ReactNode } from 'react';

export type CmsScope = 'admin' | 'instructor';

interface CmsScopeContextValue {
  scope: CmsScope;
  /** Restrict data to a single course (used inside CourseBuilder tabs). */
  courseId?: string;
  /** Current user id — used by instructor mode to set ownership fields. */
  userId?: string;
}

const CmsScopeContext = createContext<CmsScopeContextValue>({ scope: 'admin' });

export const CmsScopeProvider = ({
  scope,
  courseId,
  userId,
  children,
}: CmsScopeContextValue & { children: ReactNode }) => (
  <CmsScopeContext.Provider value={{ scope, courseId, userId }}>{children}</CmsScopeContext.Provider>
);

export const useCmsScope = () => useContext(CmsScopeContext);
export const useIsInstructorScope = () => useContext(CmsScopeContext).scope === 'instructor';
export const useIsAdminScope = () => useContext(CmsScopeContext).scope === 'admin';
