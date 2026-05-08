# ConvertKit

ConvertKit is an email marketing platform for creators.

## Features

- Email sequences
- Landing pages
- Commerce
- Tags

## Installation

```bash
npm install @timps/convertkit
```

## Usage

### Add Subscriber

```typescript
await agent.tools.addSubscriber({
  email: 'user@example.com',
});
```

### Create Form

```typescript
const form = await agent.tools.createForm({
  title: 'Signup Form',
});
```

## API Reference

`timps convertkit subscriber` - Manage subscribers

`timps convertkit form` - Manage forms