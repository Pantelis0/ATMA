import type { TradeIntent } from "@atma/shared";

export class PaperBroker {
  async submit(intent: TradeIntent) {
    return {
      mode: "paper",
      status: "submitted",
      brokerOrderId: `paper_${Date.now()}`,
      intent
    };
  }
}

