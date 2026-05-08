---
sidebar_position: 26
---

# Stripe Integration

Connect Stripe for payment processing and subscription management.

## Features

- **Payment Processing**: Accept payments via cards, wallets
- **Subscriptions**: Manage recurring billing
- **Invoices**: Create and send invoices
- **Customers**: CRM for payment customers
- **Webhooks**: Real-time payment notifications

## Authentication

### API Key

```bash
timps connect stripe
```

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Triggers

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Create success card |
| `payment_intent.failed` | Alert card |
| `customer.subscription.created` | Welcome card |
| `invoice.paid` | Receipt card |

## Code Examples

```typescript
const stripe = new Stripe({ apiKey: process.env.STRIPE_SECRET_KEY });

// Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
});

// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
});
```

## Webhook Events

```javascript
app.post('/webhook', (req, res) => {
  const event = req.body;
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle success
      break;
    case 'payment_intent.payment_failed':
      // Handle failure
      break;
  }
});
```