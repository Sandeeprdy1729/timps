# Airtable

Airtable is a low-code platform for building collaborative apps.

## Features

- Bases
- Tables
- Views
- Automations
- Interfaces

## Installation

```bash
npm install @timps/airtable
```

## Usage

### Create Record

```typescript
await agent.tools.createRecord({
  baseId: 'app123',
  tableName: 'Tasks',
  fields: { title: 'New task', status: 'Todo' },
});
```

### List Records

```typescript
const records = await agent.tools.listRecords({
  baseId: 'app123',
  tableName: 'Tasks',
});
```

## API Reference

`timps airtable record` - Manage records

`timps airtable base` - Manage bases