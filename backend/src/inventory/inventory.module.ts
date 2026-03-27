import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsModule } from '../notifications/notifications.module';
import { OrderEntity } from '../orders/entities/order.entity';
import { UsersModule } from '../users/users.module';

import { InventoryAlertController } from './controllers/inventory-alert.controller';
import { AlertPreferenceEntity } from './entities/alert-preference.entity';
import { InventoryAlertEntity } from './entities/inventory-alert.entity';
import { InventoryStockEntity } from './entities/inventory-stock.entity';
import { InventoryEntity } from './entities/inventory.entity';
import { InventoryEventListener } from './inventory-event.listener';
import { InventoryForecastingService } from './inventory-forecasting.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { DonorOutreachProcessor } from './processors/donor-outreach.processor';
import { InventoryAlertService } from './services/inventory-alert.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      InventoryEntity,
      InventoryStockEntity,
      InventoryAlertEntity,
      AlertPreferenceEntity,
    ]),
    BullModule.registerQueue({
      name: 'donor-outreach',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [InventoryController, InventoryAlertController],
  providers: [
    InventoryService,
    InventoryForecastingService,
    InventoryEventListener,
    DonorOutreachProcessor,
    InventoryAlertService,
  ],
  exports: [
    InventoryService,
    InventoryForecastingService,
    InventoryAlertService,
  ],
})
export class InventoryModule {}
