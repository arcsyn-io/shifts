import type {
  CreateOrganizationInvitationRequest,
  CreateOrganizationRequest,
  UpdateOrganizationMemberRequest,
} from '@arcsyn-shift/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptOrganizationInvitation,
  createOrganization,
  createOrganizationInvitation,
  revokeOrganizationMember,
  updateOrganizationMember,
} from '@/features/organizations/api/organizations';
import { organizationQueryKeys } from '@/features/organizations/queries/organizations';

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrganizationRequest) => createOrganization(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list() });
    },
  });
}

export function useAcceptOrganizationInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => acceptOrganizationInvitation(invitationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.invitations() }),
      ]);
    },
  });
}

export function useCreateOrganizationInvitationMutation(slug: string) {
  return useMutation({
    mutationFn: (input: CreateOrganizationInvitationRequest) =>
      createOrganizationInvitation(slug, input),
  });
}

export function useUpdateOrganizationMemberMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateOrganizationMemberRequest }) =>
      updateOrganizationMember(slug, userId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.members(slug) }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: organizationQueryKeys.list() }),
      ]);
    },
  });
}

export function useRevokeOrganizationMemberMutation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => revokeOrganizationMember(slug, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}
