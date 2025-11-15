import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useMembership } from '@/hooks/useMembership';
import { supabase } from '@/integrations/supabase/client';
import * as AuthContext from '@/contexts/AuthContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useMembership', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty state when no user', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null, memberships: [] } as any);
    const { result } = renderHook(() => useMembership());
    expect(result.current.membership).toBeNull();
    expect(result.current.companyId).toBeUndefined();
    expect(result.current.hasMultipleCompanies).toBe(false);
  });
});
