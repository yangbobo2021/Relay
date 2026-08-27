# Scripts

Developer automation lives here.

Prefer small scripts with clear names and no hidden production side effects.

## Record the English Plugin Manager demo

`record-dsh-plugin-manager-english-demo.mjs` records a real, isolated DSH web
session that searches for, plans, confirms, and installs the Codex plugin. It
requires an existing DSH credentials file and never prints its contents:

```sh
DSH_DEMO_CREDENTIALS="$HOME/.dsh/.credentials.yaml" \
  node scripts/record-dsh-plugin-manager-english-demo.mjs
```

The raw recording, final proof screenshot, and event timeline are written under
`.artifacts/dsh-plugin-manager-english-demo/` by default. The temporary DSH home
and installed demo profile are removed after the run.

After editing the MP4, run the media acceptance check:

```sh
npm run verify:dsh-plugin-manager-english-demo
```

It performs a full decode, verifies the frame count and faststart layout, rejects
audio and black intervals, and checks that the first frame is a fully rendered
DSH screen instead of an incomplete browser canvas.
