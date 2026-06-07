// apps/api/src/admin/decorators/require-super-admin.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequireSuperAdmin = () => SetMetadata('requireSuperAdmin', 'SUPER_ADMIN');