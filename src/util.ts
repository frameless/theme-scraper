import slug from "limax";
import { join } from "node:path";

export const createGemeenteData = (url) => {
	const parsed = new URL(url);
	const host = parsed.hostname.replace(/^www\./i, "");
	const urlSlug = slug(host);
	const dir = `./tmp/${urlSlug}/`;
	return {
		url,
		dir: dir,
		slug: urlSlug,
		getCssPath: join(dir, "get-css.json"),
		getWallaceAnalysisPath: join(dir, "project-wallace.json"),
		themeInputPath: join(dir, "scraped.tokens.json"),
		themePath: join(dir, "theme.tokens.json"),
	};
};
