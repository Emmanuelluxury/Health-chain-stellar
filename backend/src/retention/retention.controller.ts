import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RetentionService } from './retention.service';
import { SensitiveDataService } from './sensitive-data.service';

@ApiTags('Retention')
@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly sensitiveDataService: SensitiveDataService,
  ) {}

  @Post('trigger')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Manually trigger retention job',
    description: 'Cleans up stale sessions, old activity logs, and sensitive data. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retention job completed successfully',
    schema: {
      example: {
        sessionsDeleted: 42,
        logsDeleted: 156,
        redactionsProcessed: 23,
        redactionsFailed: 1,
      },
    },
  })
  async triggerRetention() {
    return this.retentionService.triggerRetention();
  }

  @Get('sensitive-fields')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Get sensitive fields classification',
    description: 'Returns all classified sensitive fields across entities. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensitive fields retrieved successfully',
  })
  async getSensitiveFields() {
    return this.sensitiveDataService.getSensitiveFields();
  }

  @Get('policies')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Get retention policies',
    description: 'Returns all active retention policies. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retention policies retrieved successfully',
  })
  async getRetentionPolicies() {
    return this.sensitiveDataService.getRetentionPolicies();
  }

  @Get('redactions')
  @RequirePermissions(Permission.ADMIN_ACCESS)
  @ApiOperation({
    summary: 'Get data redaction audit log',
    description: 'Returns audit log of all data redactions performed. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Redaction audit log retrieved successfully',
  })
  async getRedactionAudit() {
    return this.sensitiveDataService.getRedactionAudit();
  }
}
