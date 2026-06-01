# China Travel Compass

English-language China travel guide for international visitors, published at `https://travel.juzhiic.com`.

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

In the GitHub repository, open `Settings > Pages` and select `GitHub Actions` as the source. The committed `public/CNAME` file configures `travel.juzhiic.com`.

Configure these DNS records with your domain provider:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | travel | playcase217.github.io |

After DNS propagation, enable `Enforce HTTPS` under `Settings > Pages`.
