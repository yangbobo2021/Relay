import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

export class RelayManagementGateway extends TypertRemoteService {
  constructor(ctx, { relayRuntime, monitorWorker }) {
    super(ctx, "relayManagement");
    this.relayRuntime = relayRuntime;
    this.monitorWorker = monitorWorker;
  }

  list() {
    return { registrations: this.relayRuntime.listWaits() };
  }

  cancel(sessionId) {
    return { registration: this.relayRuntime.cancelWaits(sessionId) };
  }

  async runNow(monitorId) {
    const result = await this.monitorWorker.checkMonitor(monitorId, { force: true });
    return {
      result,
      registrations: this.relayRuntime.listWaits(),
    };
  }
}
