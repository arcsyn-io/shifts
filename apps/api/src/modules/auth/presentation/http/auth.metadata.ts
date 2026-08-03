import { SetMetadata } from '@nestjs/common';

export const AUTH_PUBLIC_METADATA = 'auth:public';
export const AUTH_SKIP_ORIGIN_METADATA = 'auth:skip-origin';
export const AUTH_REQUIRE_CSRF_METADATA = 'auth:require-csrf';

export const PublicRoute = () => SetMetadata(AUTH_PUBLIC_METADATA, true);
export const RequireCsrf = () => SetMetadata(AUTH_REQUIRE_CSRF_METADATA, true);
