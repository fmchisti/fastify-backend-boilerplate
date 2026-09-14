# fastra

Create a type-safe Fastify + TypeScript API from [Fastra](https://github.com/fmchisti/fastra).

```bash
pnpm dlx fastra shop-api
```

This is the same CLI as `pnpm create fastra shop-api` (package [`create-fastra`](https://www.npmjs.com/package/create-fastra)): it downloads the template, installs dependencies, runs setup (auth, ORM, storage, Redis, deploy target), and makes the first commit.

See [create-fastra](https://www.npmjs.com/package/create-fastra) for all options, for example:

```bash
pnpm dlx fastra shop-api --auth logto --orm prisma --storage s3 --redis redis --deploy railway --yes
```
