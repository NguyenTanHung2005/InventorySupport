import { PropsWithChildren } from 'react';
import { useAuth } from '../store/auth.store';
import { UserRole } from '../types';
export function RoleBasedView({ roles, children }: PropsWithChildren<{ roles: UserRole[] }>) { const { user } = useAuth(); return user && roles.includes(user.role) ? children : null; }
