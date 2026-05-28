import { corePrisma } from './src/config/core/core.prisma';

async function run() {
  try {
    const data = {
      category: 'auth',
      eventType: 'auth.login_failed',
      severity: 'warning',
      outcome: 'failure',
      message: 'Intento de sesión fallido: antigravityp5@gmail.com',
      actorEmail: 'antigravityp5@gmail.com',
      metadata: { error: 'AUTH_ACCOUNT_NOT_VERIFIED' }
    };
    
    const event = await corePrisma.globalAuditEvent.create({
      data: {
          category: data.category,
          eventType: data.eventType,
          severity: data.severity,
          outcome: data.outcome,
          message: data.message,
          tenantId: undefined,
          affectedTenantId: undefined,
          actorUserId: undefined,
          actorEmail: data.actorEmail,
          actorRole: undefined,
          targetType: undefined,
          targetId: undefined,
          targetLabel: undefined,
          ipAddress: undefined,
          userAgent: undefined,
          requestId: undefined,
          isImpersonation: false,
          isSensitive: false,
          oldValues: undefined,
          newValues: undefined,
          metadata: data.metadata,
      }
    });
    console.log('Success:', event);
  } catch (err) {
    console.error('FAILED!', err);
  } finally {
    await corePrisma.$disconnect();
  }
}

run();
