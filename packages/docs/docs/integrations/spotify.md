# Spotify

Spotify is a music streaming service with Web API.

## Features

- Playback control
- Playlist management
- Search
- User profiles
- Currently playing
- Recommendations

## Installation

```bash
npm install @timps/spotify
```

## Configuration

```typescript
import { createAgent } from 'timps-code';
import { spotifyPlugin } from '@timps/spotify';

const agent = createAgent({
  plugins: [
    spotifyPlugin({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    }),
  ],
});
```

## Usage

### Play

```typescript
await agent.tools.spotifyPlay({
  contextUri: 'spotify:playlist:123',
});
```

### Search

```typescript
const results = await agent.tools.spotifySearch({
  query: 'Beatles',
  type: 'track',
});
```

### Get Recommendations

```typescript
const tracks = await agent.tools.spotifyRecommendations({
  seedTracks: ['track_123'],
  limit: 10,
});
```

## API Reference

`timps spotify play` - Control playback

`timps spotify search` - Search Spotify