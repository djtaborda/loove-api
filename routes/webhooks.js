import { Router } from 'express';
import { applyPlanByEmail } from '../lib/payments.js';
const r = Router();
// Stripe
r.post('/stripe', async (req, res) => {
// validação de assinatura omitida (configure STRIPE_SIGNING_SECRET)
const event = req.body || {};
if (event.type === 'checkout.session.completed') {
const email = event.data?.object?.customer_details?.email;
const plan = (event.data?.object?.metadata?.plan ||
'premium').toLowerCase();
await applyPlanByEmail(email, plan);
}
res.json({ received: true });
});
// Mercado Pago / Hotmart / Kiwify — placeholders
r.post('/mercadopago', async (req, res) => { res.json({ received:
true }); });
r.post('/hotmart', async (req, res) => { res.json({ received: true }); });
r.post('/kiwify', async (req, res) => { res.json({ received: true }); });
export default r;
