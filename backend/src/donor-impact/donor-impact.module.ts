import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BloodUnitEntity } from '../blood-units/entities/blood-unit.entity';
import { OrderEntity } from '../orders/entities/order.entity';

import { DonorImpactController } from './donor-impact.controller';
import { DonorImpactService } from './donor-impact.service';

@Module({
  imports: [TypeOrmModule.forFeature([BloodUnitEntity, OrderEntity])],
  controllers: [DonorImpactController],
  providers: [DonorImpactService],
  exports: [DonorImpactService],
})
export class DonorImpactModule {}
