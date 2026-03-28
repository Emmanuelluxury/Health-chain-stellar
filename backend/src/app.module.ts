import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { SorobanModule } from './soroban/soroban.module';
import { ApprovalModule } from './approvals/approval.module';
import { DonationModule } from './donations/donation.module';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { ReputationModule } from './reputation/reputation.module';
import { FeePolicyModule } from './fee-policy/fee-policy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_DATABASE', 'health_chain'),
        autoLoadEntities: true,
        synchronize: true, // DEV ONLY
      }),
      inject: [ConfigService],
    }),
    SorobanModule,
    ApprovalModule,
    DonationModule,
    OrdersModule,
    UsersModule,
    AuthModule,
    InventoryModule,
    NotificationsModule,
    UserActivityModule,
    ReputationModule,
    FeePolicyModule,
  ],
})
export class AppModule {}
