import { Module } from '@nestjs/common';
import { ApplicationContext } from '../../infrastructure/context/application-context.js';
import { TransactionManager } from '../../infrastructure/database/transaction-manager.js';
import { ErrorReporter } from '../../infrastructure/errors/error-reporter.js';
import { ErrorReportingModule } from '../../infrastructure/errors/error-reporting.module.js';
import { AuthModule } from '../auth/index.js';
import { ORGANIZATIONS_ERROR_REPORTER } from './presentation/http/helpers/organizations-error-reporter.js';
import { OrganizationsService } from './application/organizations.service.js';
import { OrganizationInvitationsController } from './presentation/http/organization-invitations.controller.js';
import { OrganizationsHttpExceptionFilter } from './presentation/http/filters/organizations-http-exception.filter.js';
import { OrganizationsController } from './presentation/http/organizations.controller.js';
import { DrizzleOrganizationsRepository } from './repository/drizzle-organizations.repository.js';
import { ORGANIZATIONS_REPOSITORY } from './repository/organizations.repository.js';

type OrganizationsRepositoryPort =
  import('./repository/organizations.repository.js').OrganizationsRepository;

@Module({
  imports: [AuthModule, ErrorReportingModule],
  controllers: [OrganizationsController, OrganizationInvitationsController],
  providers: [
    OrganizationsHttpExceptionFilter,
    {
      provide: ORGANIZATIONS_ERROR_REPORTER,
      useExisting: ErrorReporter,
    },
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
