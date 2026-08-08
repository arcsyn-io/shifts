import { Module } from '@nestjs/common';
import type { Database } from '@arcsyn-shift/database';
import { DATABASE } from '../../infrastructure/database/database.module.js';
import { AuthModule } from '../auth/index.js';
import { OrganizationsService } from './application/organizations.service.js';
import { OrganizationInvitationsController } from './presentation/http/organization-invitations.controller.js';
import { OrganizationsController } from './presentation/http/organizations.controller.js';
import { DrizzleOrganizationsRepository } from './repository/drizzle-organizations.repository.js';
import { ORGANIZATIONS_REPOSITORY } from './repository/organizations.repository.js';

type OrganizationsRepositoryPort =
  import('./repository/organizations.repository.js').OrganizationsRepository;

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrganizationInvitationsController],
  providers: [
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useFactory: (database: Database) => new DrizzleOrganizationsRepository(database),
      inject: [DATABASE],
    },
    {
      provide: OrganizationsService,
      useFactory: (repository: OrganizationsRepositoryPort) => new OrganizationsService(repository),
      inject: [ORGANIZATIONS_REPOSITORY],
    },
  ],
})
export class OrganizationsModule {}
