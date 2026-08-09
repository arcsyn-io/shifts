import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createOrganizationInvitationRequestSchema,
  createOrganizationRequestSchema,
  organizationMemberSchema,
  organizationSlugSchema,
  updateOrganizationMemberRequestSchema,
  type CreateOrganizationInvitationRequest,
  type CreateOrganizationRequest,
  type Organization,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationMembersResponse,
  type OrganizationsResponse,
  type UpdateOrganizationMemberRequest,
} from '@arcsyn-shift/contracts';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BffMutationGuard, BffSessionGuard, RequireBffJsonBody } from '../../../auth/index.js';
import { OrganizationsService } from '../../application/organizations.service.js';
import {
  mapOrganizationsErrors,
  OrganizationValidationPipe,
} from './helpers/organizations-http.js';

const NO_STORE = 'private, no-store';
const slugPipe = new OrganizationValidationPipe(organizationSlugSchema);
const userIdPipe = new OrganizationValidationPipe(organizationMemberSchema.shape.userId);
const createOrganizationPipe = new OrganizationValidationPipe(createOrganizationRequestSchema);
const createInvitationPipe = new OrganizationValidationPipe(
  createOrganizationInvitationRequestSchema,
);
const updateMemberPipe = new OrganizationValidationPipe(updateOrganizationMemberRequestSchema);

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService) private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffSessionGuard)
  @ApiOperation({ summary: 'List organizations accessible to the current principal' })
  @ApiResponse({ status: 200, description: 'Active organization memberships' })
  list(): Promise<OrganizationsResponse> {
    return mapOrganizationsErrors(() => this.organizationsService.list());
  }

  @Post()
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffMutationGuard)
  @RequireBffJsonBody()
  @ApiOperation({ summary: 'Create an organization and its first owner atomically' })
  @ApiBody({ schema: { type: 'object', required: ['name', 'slug'] } })
  @ApiResponse({ status: 201, description: 'Created organization' })
  create(@Body(createOrganizationPipe) body: CreateOrganizationRequest): Promise<Organization> {
    return mapOrganizationsErrors(() =>
      this.organizationsService.create({ name: body.name, slug: body.slug }),
    );
  }

  @Get(':slug')
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffSessionGuard)
  @ApiOperation({ summary: 'Get an accessible organization by its canonical slug' })
  @ApiResponse({ status: 200, description: 'Accessible organization' })
  get(@Param('slug', slugPipe) slug: string): Promise<Organization> {
    return mapOrganizationsErrors(() => this.organizationsService.get({ slug }));
  }

  @Get(':slug/members')
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffSessionGuard)
  @ApiOperation({ summary: 'List active members of an accessible organization' })
  @ApiResponse({ status: 200, description: 'Active members' })
  listMembers(@Param('slug', slugPipe) slug: string): Promise<OrganizationMembersResponse> {
    return mapOrganizationsErrors(() => this.organizationsService.listMembers({ slug }));
  }

  @Patch(':slug/members/:userId')
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffMutationGuard)
  @RequireBffJsonBody()
  @ApiOperation({ summary: 'Change an organization member role as an owner' })
  @ApiBody({ schema: { type: 'object', required: ['role'] } })
  @ApiResponse({ status: 200, description: 'Updated member' })
  updateMember(
    @Param('slug', slugPipe) slug: string,
    @Param('userId', userIdPipe) userId: string,
    @Body(updateMemberPipe) body: UpdateOrganizationMemberRequest,
  ): Promise<OrganizationMember> {
    return mapOrganizationsErrors(() =>
      this.organizationsService.updateMember({ slug, userId, role: body.role }),
    );
  }

  @Delete(':slug/members/:userId')
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffMutationGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an organization membership' })
  @ApiResponse({ status: 204, description: 'Membership revoked' })
  revokeMember(
    @Param('slug', slugPipe) slug: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<void> {
    return mapOrganizationsErrors(() => this.organizationsService.revokeMember({ slug, userId }));
  }

  @Post(':slug/invitations')
  @Header('Cache-Control', NO_STORE)
  @UseGuards(BffMutationGuard)
  @RequireBffJsonBody()
  @ApiOperation({ summary: 'Invite an existing account to an organization' })
  @ApiBody({ schema: { type: 'object', required: ['email', 'role'] } })
  @ApiResponse({ status: 201, description: 'Created invitation' })
  createInvitation(
    @Param('slug', slugPipe) slug: string,
    @Body(createInvitationPipe) body: CreateOrganizationInvitationRequest,
  ): Promise<OrganizationInvitation> {
    return mapOrganizationsErrors(() =>
      this.organizationsService.createInvitation({
        slug,
        email: body.email,
        role: body.role,
      }),
    );
  }
}
