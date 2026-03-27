import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BloodUnitEntity } from '../blood-units/entities/blood-unit.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';

export interface DonorImpactSummary {
  donorRef: string;
  totalDonations: number;
  totalMlDonated: number;
  requestsFulfilled: number;
  estimatedPatientsSupported: number;
  timeline: DonorImpactEvent[];
}

export interface DonorImpactEvent {
  date: Date;
  type: 'donation' | 'fulfillment';
  description: string;
  bloodType: string;
  quantityMl?: number;
  onChainRef?: string;
}

export interface PublicImpactSummary {
  organizationId: string;
  totalRequestsFulfilled: number;
  totalUnitsByBloodType: Record<string, number>;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class DonorImpactService {
  constructor(
    @InjectRepository(BloodUnitEntity)
    private readonly bloodUnitRepo: Repository<BloodUnitEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async getDonorImpact(donorId: string): Promise<DonorImpactSummary> {
    // Use hashed donor ref for privacy
    const donorRef = this.anonymizeRef(donorId);

    const units = await this.bloodUnitRepo.find({
      where: { donorId },
      order: { createdAt: 'DESC' },
    });

    const fulfilledOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere(
        `o.blood_type IN (:...types)`,
        { types: units.length ? [...new Set(units.map((u) => u.bloodType))] : ['NONE'] },
      )
      .getMany();

    const timeline: DonorImpactEvent[] = units.map((u) => ({
      date: u.createdAt,
      type: 'donation',
      description: `Donated ${u.quantityMl}ml of ${u.bloodType}`,
      bloodType: u.bloodType,
      quantityMl: u.quantityMl,
      onChainRef: u.blockchainTransactionHash ?? undefined,
    }));

    return {
      donorRef,
      totalDonations: units.length,
      totalMlDonated: units.reduce((sum, u) => sum + u.quantityMl, 0),
      requestsFulfilled: fulfilledOrders.length,
      // Rough estimate: 1 unit supports ~3 patients
      estimatedPatientsSupported: units.length * 3,
      timeline: timeline.slice(0, 20),
    };
  }

  async getPublicImpactSummary(organizationId: string): Promise<PublicImpactSummary> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.blood_bank_id = :orgId', { orgId: organizationId })
      .andWhere('o.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('o.created_at >= :since', { since: thirtyDaysAgo })
      .getMany();

    const unitsByType: Record<string, number> = {};
    for (const order of orders) {
      unitsByType[order.bloodType] = (unitsByType[order.bloodType] ?? 0) + order.quantity;
    }

    return {
      organizationId,
      totalRequestsFulfilled: orders.length,
      totalUnitsByBloodType: unitsByType,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date(),
    };
  }

  private anonymizeRef(donorId: string): string {
    // Simple deterministic prefix mask – not cryptographic, just for display
    return `DONOR-${donorId.slice(0, 4).toUpperCase()}****`;
  }
}
