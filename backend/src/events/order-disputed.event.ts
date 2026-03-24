export class OrderDisputedEvent {
  constructor(
    public readonly orderId: string,
    public readonly disputeId: string,
    public readonly reason: string,
  ) {}
}
