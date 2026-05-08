# Tutorial: Using TIMPS with Next.js

This tutorial shows how to use TIMPS to build a Next.js application.

## Setup

```bash
# Install TIMPS
npm install -g timps-code

# Start Next.js app
npx create-next-app my-app
cd my-app
```

## Using TIMPS

### Create Components

```bash
timps "create a Hero component with title, subtitle, and CTA button"
```

TIMPS will:
1. Check existing patterns
2. Create component following Next.js conventions
3. Add to semantic memory

### Add API Routes

```bash
timps "create an API route for /api/users that returns a list of users"
```

### Style Components

```bash
timps "add Tailwind styles to make the Hero look modern"
```

## Memory in Action

After first component, TIMPS remembers your style preferences:

```bash
timps "create another Hero component"  # Uses remembered patterns
```

## Full Example

```bash
# Setup
timps "set up the project with TypeScript and Tailwind"

# Create pages
timps "create the landing page with Hero, Features, and Footer sections"
timps "create the about page with team section"

# Add API
timps "create API routes for contact form and newsletter"

# Test
timps "create tests for all pages and API routes"
```

## Pro Tips

1. **Be specific** - "create a modern, minimalist Hero" vs "create Hero"
2. **Use context** - Reference previous work: "add to the navigation from the landing page"
3. **Check memory** - `timps memory read` to see remembered patterns