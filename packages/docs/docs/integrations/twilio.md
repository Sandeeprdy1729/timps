# Twilio

Twilio provides communication APIs for SMS, voice, and video.

## Features

- SMS/MMS
- Voice calls
- Video
- WhatsApp
- Verify
- Flex

## Installation

```bash
npm install @timps/twilio
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { twilioPlugin } from '@timps/twilio';

const agent = createAgent({
  plugins: [
    twilioPlugin({
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
    }),
  ],
});
```

## Usage

### Send SMS

```typescript
await agent.tools.sendSms({
  to: '+1234567890',
  body: 'Hello!',
});
```

### Make Call

```typescript
await agent.tools.makeCall({
  to: '+1234567890',
  url: 'http://example.com/voice.xml',
});
```

## API Reference

`timps twilio sms` - Send SMS

`timps twilio call` - Make call