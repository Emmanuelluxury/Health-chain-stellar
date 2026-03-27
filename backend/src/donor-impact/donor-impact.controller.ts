import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/enums/permission.enum';

import { DonorImpactService } from './donor-impact.service';

@Controller('donor-impact')
export class DonorImpactController {
  constructor(private readonly donorImpactService: DonorImpactService) {}

  @RequirePermissions(Permission.VIEW_BLOODUNIT_TRAIL)
  @Get(':donorId')
  getDonorImpact(@Param('donorId', ParseUUIDPipe) donorId: string) {
    return this.donorImpactService.getDonorImpact(donorId);
  }

  @Get('public/:organizationId')
  getPublicImpact(@Param('organizationId') organizationId: string) {
    return this.donorImpactService.getPublicImpactSummary(organizationId);
  }
}
