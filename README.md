# China Travel Compass

English-language China travel guide for international visitors, published at `https://juzhiic.com`.

## Local preview

```bash
npm run dev
```

Open `http://localhost:4173`.

## Publish an article

1. Add a Markdown file under `content/guides/`.
2. Add optimized WebP images under `public/images/guides/<slug>/`.
3. Run `npm run build`.
4. Commit and push to `main`. GitHub Actions publishes the new version.

## GitHub Pages setup

In the GitHub repository, open `Settings > Pages` and select `GitHub Actions` as the source. The committed `public/CNAME` file configures `juzhiic.com`.

Configure these DNS records with your domain provider:

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | playcase217.github.io |

After DNS propagation, enable `Enforce HTTPS` under `Settings > Pages`.
