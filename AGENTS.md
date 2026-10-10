# Public repository boundaries

Keep `.idea/`, `handoff/`, `output/` and `.private-repo-backups/` local. They contain private working material and are not website dependencies. Never commit or upload their contents.

The only approved CV document is `site/public/Tianjian-Qin-CV.pdf`. CV source files, class files, templates, archives and historical CVs must stay local. This applies to every CV version and every Git ref published to GitHub. A replacement PDF requires removing the superseded CV blobs from published history. Preserve a private local backup before rewriting history, and push only the intended public branch.

Keep website code and approved public assets in `site/`. Follow `site/AGENTS.md` for website work. Write natural, self-contained comments and documentation without references to the conversation.
