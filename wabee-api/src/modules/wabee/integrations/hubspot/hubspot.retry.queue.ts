type AsyncJob = () => Promise<void>;

interface QueuedJob {
    id:          string;
    fn:          AsyncJob;
    retryCount:  number;
    maxRetries:  number;
}

class HubSpotRetryQueue {
    private _schedule(job: QueuedJob) {
        // Exponential backoff: 2s, 4s, 8s … max 64s
        const delay = Math.min(2_000 * Math.pow(2, job.retryCount), 64_000);
        setTimeout(async () => {
            try {
                await job.fn();
            } catch (err) {
                const attempt = job.retryCount + 1;
                console.error(`[HubSpot Queue] Job "${job.id}" falló en intento ${attempt}:`, (err as Error).message);
                if (job.retryCount < job.maxRetries) {
                    this._schedule({ ...job, retryCount: attempt });
                } else {
                    console.error(`[HubSpot Queue] Job "${job.id}" descartado después de ${attempt} intentos.`);
                }
            }
        }, delay);
    }

    enqueue(id: string, fn: AsyncJob, maxRetries = 3) {
        this._schedule({ id, fn, retryCount: 0, maxRetries });
    }
}

export const hubSpotRetryQueue = new HubSpotRetryQueue();
