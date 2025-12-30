import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
 
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

   
    const { user } = context.switchToHttp().getRequest();

   
    this.logger.debug(`Vérification des rôles pour l'utilisateur: ${user?.email || 'Inconnu'}`);
    this.logger.debug(`Rôles requis: ${requiredRoles.join(', ')}`);
    this.logger.debug(`Rôle actuel: ${user?.role}`);

    if (!user || !user.role) {
      this.logger.error('Utilisateur ou rôle manquant dans la requête');
      throw new ForbiddenException("Accès refusé : Profil utilisateur introuvable");
    }

   
    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      this.logger.warn(`Rôle ${user.role} insuffisant pour accéder à cette ressource`);
      throw new ForbiddenException(`Accès refusé : Rôle ${user.role} insuffisant`);
    }

    return true;
  }
}