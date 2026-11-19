# IOARTS Sanity Dashboard

This Next.js application provides an administrative dashboard for managing IOARTS product posts in Sanity. It supports creating, listing, deleting, and categorizing posts, uploading images, and importing or exporting CSV files.

## Technology

- Next.js 13 App Router
- React 18 and TypeScript
- Tailwind CSS 3
- Sanity Content Lake via `@sanity/client`
- pnpm (the repository includes `pnpm-lock.yaml`)

## Getting started

### Requirements

- Node.js supported by Next.js 13
- pnpm
- A Sanity project with a dataset

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` file in the project root:

```dotenv
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production

# Server-side write token used by dashboard actions.
SANITY_API_WRITE_TOKEN=your-write-token
```

The project ID and dataset name are public Sanity configuration. `SANITY_API_WRITE_TOKEN` is a secret and must never be given a `NEXT_PUBLIC_` prefix or committed to source control.

## Access and token safety

The dashboard can create, edit, and delete Sanity content and upload images. The repository does not include app-level authentication. Do not deploy it with a write token where untrusted users can access it; put it behind an authentication or access-control layer first. Use a least-privilege token and rotate it if it may have been exposed.

## Sanity content model

The schema is defined in `schemas/post.ts` and exported from `schemas/index.ts`. It defines a `post` document with a title, slug, content, image, price, and one or more categories (`deviant-vectors` or `etsy-products`). The repository contains the schema definitions, not a Sanity Studio application; register the schema with the Studio used to manage the dataset.

## Dashboard features

- Create and list Sanity posts
- Upload images to Sanity
- Edit, add, and remove post categories
- Delete posts
- Import and export posts as CSV

## Available scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run the configured Next.js lint command |

## Project structure

```text
app/                  Dashboard page and global styles
components/           Theme provider
lib/actions.ts        Server actions for Sanity reads and writes
lib/sanity.ts         Sanity client configuration
schemas/              Sanity document schema
public/               Static images, icons, and assets
styles/               Shared styles
```

## Deployment

Deploy as a Next.js application on Vercel or another platform that supports Next.js. Configure the Sanity project ID, dataset, and write token in the deployment environment, and restrict dashboard access before enabling write operations.
