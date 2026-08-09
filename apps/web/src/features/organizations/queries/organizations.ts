import { useQuery } from '@tanstack/react-query';
import {
  fetchOrganization,
  fetchOrganizationInvitations,
  fetchOrganizationMembers,
  fetchOrganizations,
} from '@/features/organizations/api/organizations';

export const organizationQueryKeys = {
  all: ['organizations'] as const,
  list: () => [...organizationQueryKeys.all, 'list'] as const,
  invitations: () => [...organizationQueryKeys.all, 'invitations'] as const,
  detail: (slug: string) => [...organizationQueryKeys.all, 'detail', slug] as const,
  members: (slug: string) => [...organizationQueryKeys.all, 'members', slug] as const,
};

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: organizationQueryKeys.list(),
    queryFn: ({ signal }) => fetchOrganizations(signal),
    retry: false,
  });
}

export function useOrganizationInvitationsQuery() {
  return useQuery({
    queryKey: organizationQueryKeys.invitations(),
    queryFn: ({ signal }) => fetchOrganizationInvitations(signal),
    retry: false,
  });
}

export function useOrganizationQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: organizationQueryKeys.detail(slug),
    queryFn: ({ signal }) => fetchOrganization(slug, signal),
    enabled,
    retry: false,
  });
}

export function useOrganizationMembersQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: organizationQueryKeys.members(slug),
    queryFn: ({ signal }) => fetchOrganizationMembers(slug, signal),
    enabled,
    retry: false,
  });
}
