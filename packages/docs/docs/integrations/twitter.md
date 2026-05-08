# Twitter (X)

Twitter (now X) API integration for posting and managing tweets.

## Features

- Post tweets
- Manage timeline
- Search tweets
- Analytics

## Installation

```bash
npm install @timps/twitter
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { twitterPlugin } from '@timps/twitter';

const agent = createAgent({
  plugins: [
    twitterPlugin({
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
    }),
  ],
});
```

## Usage

### Post Tweet

```typescript
await agent.tools.postTweet({
  text: 'Hello from TIMPS!',
});
```

### Search

```typescript
const tweets = await agent.tools.searchTweets({
  query: 'AI coding',
  limit: 10,
});
```

## API Reference

`timps twitter tweet` - Post a tweet

`timps twitter search` - Search tweets