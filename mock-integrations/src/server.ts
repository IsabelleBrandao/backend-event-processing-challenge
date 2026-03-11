import 'dotenv/config';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sensible from '@fastify/sensible';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = '0.0.0.0';

// Probability constants for simulating unstable external services
const FAILURE_RATE = 0.15;       // 15% chance of HTTP 500
const RATE_LIMIT_RATE = 0.08;    // 8% chance of HTTP 429
const MAX_LATENCY_MS = 3000;

function randomDelay(maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * maxMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFail(): boolean {
  return Math.random() < FAILURE_RATE;
}

function shouldRateLimit(): boolean {
  return Math.random() < RATE_LIMIT_RATE;
}

async function handleIntegration(
  request: FastifyRequest,
  reply: FastifyReply,
  service: string,
): Promise<void> {
  const body = request.body as any;
  
  // Mecanismo de "Fault Injection" para validação determinística da Dead Letter Queue (DLQ)
  if (body?.ref?.startsWith('fault-injection-fail-')) {
    request.log.error({ service, ref: body.ref }, 'Synthetic error detected - Validating DLQ circuit');
    await reply.code(500).send({ error: 'Synthetic Fault Injection', service });
    return;
  }

  await randomDelay(MAX_LATENCY_MS);

  if (shouldRateLimit()) {
    request.log.warn({ service }, 'Rate limit triggered');
    await reply
      .code(429)
      .header('Retry-After', '5')
      .send({ error: 'Too Many Requests', retryAfter: 5 });
    return;
  }

  if (shouldFail()) {
    request.log.error({ service }, 'Simulated service failure');
    await reply.code(500).send({ error: 'Internal Server Error', service });
    return;
  }

  request.log.info({ service }, 'Request processed successfully');
  await reply.code(200).send({ ok: true, service, processedAt: new Date().toISOString() });
}

async function buildMockApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(sensible);

  app.post('/billing', async (req, reply) => handleIntegration(req, reply, 'billing'));
  app.post('/crm', async (req, reply) => handleIntegration(req, reply, 'crm'));
  app.post('/notifications', async (req, reply) =>
    handleIntegration(req, reply, 'notifications'),
  );

  app.get('/health', async (_req, reply) => reply.send({ status: 'ok' }));

  return app;
}

async function start(): Promise<void> {
  const app = await buildMockApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Mock integrations listening on http://${HOST}:${PORT}`);
    app.log.info(
      `Failure rate: ${FAILURE_RATE * 100}% | Rate limit rate: ${RATE_LIMIT_RATE * 100}% | Max latency: ${MAX_LATENCY_MS}ms`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
