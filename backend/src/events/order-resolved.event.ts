export class OrderResolvedEvent {
  constructor(
    public readonly orderId: string,
    public readonly resolution: string,
  ) {}
}
