import { Module } from '@nestjs/common';
import { ApplicationContext } from '../../infrastructure/context/application-context.js';
import { TransactionManager } from '../../infrastructure/database/transaction-manager.js';
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
      useFactory: (transactionManager: TransactionManager) =>
        new DrizzleOrganizationsRepository(transactionManager),
      inject: [TransactionManager],
    },
    {
      provide: OrganizationsService,
      useFactory: (
        repository: OrganizationsRepositoryPort,
        applicationContext: ApplicationContext,
        transactionManager: TransactionManager,
      ) => new OrganizationsService(repository, applicationContext, transactionManager),
      inject: [ORGANIZATIONS_REPOSITORY, ApplicationContext, TransactionManager],
    },
  ],
})
export class OrganizationsModule {}
