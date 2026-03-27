import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '../redis/redis.module';
import { UserActivityEntity } from '../user-activity/entities/user-activity.entity';

// Import entities from related modules for sensitive data
import { BloodUnit } from '../blood-units/entities/blood-unit.entity';
import { RiderEntity } from '../riders/entities/rider.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { LocationHistoryEntity } from '../location-history/entities/location-history.entity';

import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { SensitiveDataService } from './sensitive-data.service';
import { RetentionPolicyEntity } from './entities/retention-policy.entity';
import { DataRedactionEntity } from './entities/data-redaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserActivityEntity,
      BloodUnit,
      RiderEntity,
      OrganizationEntity,
      LocationHistoryEntity,
      RetentionPolicyEntity,
      DataRedactionEntity,
    ]),
    RedisModule
  ],
  providers: [RetentionService, SensitiveDataService],
  controllers: [RetentionController],
  exports: [RetentionService, SensitiveDataService],
})
export class RetentionModule {}
