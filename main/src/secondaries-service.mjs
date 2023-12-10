export class SecondariesService {
  constructor() {
    this.statusSubscribers = new Set();
    this.heartbeatIntervalMs = 2000;
    this.secondaries = new Map();

    const hosts = process.env.SECONDARY_HOSTS?.split(' ') ?? [];

    for (let i = 0; i < hosts.length; i++) {
      const id = `secondary-${i}`;
      this.secondaries.set(id, { id, host: hosts[i], status: 'Unhealthy' });
    }
  }

  async init() {
    setInterval(async () => {
      for (const secondary of this.secondaries.values()) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.heartbeatIntervalMs - 100,
        );

        try {
          await fetch(`${secondary.host}/health`, {
            signal: controller.signal,
          });
          this.updateSecondaryStatus(secondary.id, 'Healthy');
        } catch (error) {
          this.updateSecondaryStatus(secondary.id, 'Unhealthy');
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  replicateToAllInstances(message, callback) {
    const replicationPromises = [];
    for (const secondary of this.secondaries.values()) {
      const promise = this.replicateToInstance(secondary.id, message);
      replicationPromises.push(promise);

      promise
        .then(() => {
          callback(secondary.id);
        })
        .catch((e) => {
          console.log('====>ERROR', e);
        });
    }

    return Promise.all(replicationPromises);
  }

  async replicateToInstance(instanceId, message) {
    let resolveReplicationPromise;
    const replicationPromise = new Promise((res) => {
      resolveReplicationPromise = res;
    });

    const instance = this.secondaries.get(instanceId);
    if (!instance) {
      throw new Error(`Secondary ${instanceId} doesn't exist`);
    }

    const url = `${instance.host}/message`;
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify(message);

    const RETRY_INTERVAL_MS = 1000;
    const retryInterval = setInterval(async () => {
      try {
        await fetch(url, { method: 'POST', headers, body });
        clearTimeout(retryInterval);
        resolveReplicationPromise();
      } catch {
        console.log(
          `Failed to replicate ${message.id} to secondary  ${instance.id}`,
        );
      }
    }, RETRY_INTERVAL_MS);

    return replicationPromise;
  }

  getStatus() {
    const status = {};
    for (const secondary of this.secondaries.values()) {
      status[secondary.id] = secondary.status;
    }
    return status;
  }

  getAllInstances() {
    return [...this.secondaries.values()];
  }

  updateSecondaryStatus(id, newStatus) {
    const secondary = this.secondaries.get(id);
    if (!secondary) {
      throw new Error(`Secondary ${id} doesn't exists`);
    }

    const prevStatus = secondary.status;
    if (prevStatus === newStatus) {
      return;
    }

    secondary.status = newStatus;
    for (const subscriber of this.statusSubscribers) {
      subscriber(id, { prevStatus, newStatus });
    }
  }

  subscribeToStatusChange(callback) {
    this.statusSubscribers.add(callback);
  }
}
