import { Pipe, PipeTransform } from '@angular/core';
import { formatInr, formatQty, paymentTone, statusLabel, statusTone, timeAgo, unitShort } from '../core/format';
import { OrderStatus, PaymentStatus, ProductUnit } from '../core/models';

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string { return formatInr(value); }
}

@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(value: number, unit: ProductUnit): string { return formatQty(value, unit); }
}

@Pipe({ name: 'unit' })
export class UnitPipe implements PipeTransform {
  transform(unit: ProductUnit): string { return unitShort(unit); }
}

@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(status: OrderStatus): string { return statusLabel(status); }
}

@Pipe({ name: 'statusTone' })
export class StatusTonePipe implements PipeTransform {
  transform(status: OrderStatus): string { return statusTone(status); }
}

@Pipe({ name: 'paymentTone' })
export class PaymentTonePipe implements PipeTransform {
  transform(status: PaymentStatus): string { return paymentTone(status); }
}

@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(iso: string): string { return timeAgo(iso); }
}

export const SHARED_PIPES = [InrPipe, QtyPipe, UnitPipe, StatusLabelPipe, StatusTonePipe, PaymentTonePipe, TimeAgoPipe] as const;
