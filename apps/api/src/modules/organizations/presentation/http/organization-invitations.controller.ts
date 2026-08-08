import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  organizationInvitationSchema,
  type Organization,
  type OrganizationInvitationsResponse,
} from '@arcsyn-shift/contracts';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedPrincipal,
  BffMutationGuard,
  type BffPrincipal,
  BffSessionGuard,
} from '../../../auth/index.js';
import { OrganizationsService } from '../../application/organizations.service.js';
import {
  mapOrganizationsErrors,
  OrganizationValidationPipe,
} from './helpers/organizations-http.js';

const invitationIdPipe = new OrganizationValidationPipe(organizationInvitationSchema.shape.id);
const NO_STORE = 'private, no-store';

@ApiTags('organization invitations')
@Controller('organization-invitations')
export class OrganizationInvitationsController {
  constructor(
    @Inject(OrganizationsService) private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffSessionGuard)
  @ApiOperation({ summary: 'List valid pending invitations for the current principal' })
  @ApiResponse({ status: 200, description: 'Pending invitations' })
  list(
    @AuthenticatedPrincipal() principal: BffPrincipal,
  ): Promise<OrganizationInvitationsResponse> {
    return mapOrganizationsErrors(() => this.organizationsService.listInvitations({ principal }));
  }

  @Post(':invitationId/accept')
  @Header('Cache-Control', NO_STORE)
  @HttpCode(HttpStatus.OK)
  @UseGuards(BffMutationGuard)
  @ApiOperation({ summary: 'Accept an invitation atomically and idempotently' })
  @ApiResponse({ status: 200, description: 'Organization access activated' })
  accept(
    @AuthenticatedPrincipal() principal: BffPrincipal,
    @Param('invitationId', invitationIdPipe) invitationId: string,
  ): Promise<Organization> {
    return mapOrganizationsErrors(() =>
      this.organizationsService.acceptInvitation({ principal, invitationId }),
    );
  }
}
