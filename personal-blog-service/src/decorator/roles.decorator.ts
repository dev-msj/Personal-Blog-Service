import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constant/user-role.enum';

export const Roles = (...userRoles: UserRole[]) =>
  SetMetadata('roles', userRoles);
