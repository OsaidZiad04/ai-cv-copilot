# Email PDF fonts

Static Noto Sans and Noto Sans Arabic Regular/Bold are bundled to avoid runtime network font requests and support Latin/accented Latin and Arabic names.

Source: [notofonts/noto-fonts](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf), retrieved 2026-10-03. Files come from `hinted/ttf/NotoSans/` and `hinted/ttf/NotoSansArabic/`. The accompanying `LICENSE.txt` is the upstream SIL Open Font License 1.1. These assets are used only by the server PDF renderer, not the browser UI. Other scripts and emoji are not guaranteed; review those names before enabling delivery for them.
