import {
  PendingRequest,
  PendingRequestPriority,
  VehicleType,
  PendingRequestItem,
} from '../../../../services/pending request/pending-request-service.service';

export type PendingRequestVM = Omit<PendingRequest, 'priority'> & {
  priority?: PendingRequestPriority | null;
};

export type VehicleChipVM = {
  type: VehicleType;
  label: string;
  count: number;
};

export type PricingCol =
  | 'orderPrice'
  | 'guaranteeMinOrders'
  | 'fixedAmount'
  | 'allowanceAmount'
  | 'totalAmount';

export type VehicleGroupVM = {
  type: VehicleType;
  count: number;
  cols: PricingCol[];
  values: Record<PricingCol, string>;
};

// export { PendingRequestItem, PendingRequestPriority, VehicleType };
