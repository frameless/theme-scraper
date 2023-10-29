import gemeenten from "./gemeenten.json" assert { type: "json" };
import getCss from "get-css";
import { access, constants, mkdir, open } from "node:fs/promises";
import slug from "limax";
import { join } from "node:path";
import { analyze } from "@projectwallace/css-analyzer";
import Color from "color";

let data = [
	...gemeenten,
	"https://cms.dordrecht.nl",
	"https://www.h-i-ambacht.nl",
	"https://www.oostzaan.nl/mozard/!suite05.scherm1466",
	"https://www.wormerland.nl/mozard/!suite05.scherm1466",
	"https://www.zaanstad.nl/mozard/!suite05.scherm1239",
].map((url) => {
	const parsed = new URL(url);
	const host = parsed.hostname.replace(/^www\./i, "");
	const urlSlug = slug(host);
	return {
		url,
		slug: urlSlug,
	};
});

console.log(data);

const fileExists = async (path) => {
	let exists = false;
	try {
		await access(path, constants.R_OK);
		exists = true;
	} catch (_) {}
	return exists;
};

function promiseTimeout(time) {
	return new Promise((resolve) => setTimeout(resolve, time));
}

let timeoutPool = 0;

data
	// .filter((_, index) => index < 10)
	.forEach(async ({ slug, url }) => {
		console.log(`Analyze website: ${url}`);

		const dir = join(".", "tmp", slug);
		const x = await mkdir(dir, { recursive: true });

		const options = {
			timeout: 5000,
		};

		const getCssPath = join(dir, "get-css.json");
		const getWallaceAnalysisPath = join(dir, "project-wallace.json");
		const themeInputPath = join(dir, "theme-input.json");
		const themePath = join(dir, "theme.json");

		let exists = await fileExists(getCssPath);
		let wallaceExists = await fileExists(getWallaceAnalysisPath);

		let scrapedCss;
		if (exists) {
			const file = await open(getCssPath, "r");
			console.log(`Use scraped CSS from cache: ${url}`);
			try {
				scrapedCss = JSON.parse(await file.readFile({ encoding: "utf8" }));
			} catch (e) {
				console.log(`Cannot read or parse cache: ${getCssPath}`);
			}
			file.close();
		}

		if (!scrapedCss) {
			scrapedCss = await promiseTimeout(2000 * timeoutPool++).then(() => {
				return getCss(url, options)
					.then(async function (response) {
						const file = await open(getCssPath, "w");
						await file.writeFile(JSON.stringify(response, null, 2));
						file.close();
						return response;
					})
					.catch(function (error) {
						console.log(`Error scraping website: ${url}`);
						console.error(error);
					});
			});
		}

		let analysis;

		if (scrapedCss && !wallaceExists) {
			const externalCss = scrapedCss.links.map(({ css }) => css).join("\n");
			const localCss = scrapedCss.css;
			const css = [externalCss, localCss].join("");

			console.log(`Analyze CSS: ${url}`);
			try {
				analysis = analyze(css);
			} catch (e) {
				console.log(`Error scraping website: ${url}`);
				console.error(e);
				return;
			}
			const wallaceFile = await open(getWallaceAnalysisPath, "w");

			await wallaceFile.writeFile(JSON.stringify(analysis, null, 2));
			wallaceFile.close();
		} else if (wallaceExists) {
			console.log(
				`Use Project Wallace analysis from cache: ${getWallaceAnalysisPath}`,
			);
			const file = await open(getWallaceAnalysisPath, "r");
			console.log(`Use scraped analysis from cache: ${url}`);
			try {
				analysis = JSON.parse(await file.readFile({ encoding: "utf8" }));
			} catch (e) {
				console.log(`Cannot read or parse cache: ${getWallaceAnalysisPath}`);
			}
			file.close();
		}

		if (analysis) {
			// Do not include CSS system colors as token
			// https://drafts.csswg.org/css-color/#css-system-colors

			const isCssVariable = (value) => /\var\(/i.test(value);
			const isDynamicCss = (value) => /(calc|var)\(/i.test(value);
			const isUnusableColor = (color) =>
				/(Canvas|CanvasText|LinkText|VisitedText|ActiveText|ButtonFace|ButtonText|ButtonBorder|Field|FieldText|Highlight|HighlightText|SelectedItem|SelectedItemText|Mark|MarkText|GrayText|AccentColor|AccentColorText|ActiveBorder|ActiveCaption|AppWorkspace|Background|ButtonHighlight|ButtonShadow|CaptionText|InactiveBorder|InactiveCaption|InactiveCaptionText|InfoBackground|InfoText|Menu|MenuText|Scrollbar|ThreeDDarkShadow|ThreeDFace|ThreeDHighlight|ThreeDLightShadow|ThreeDShadow|Window|WindowFrame|WindowText)/i.test(
					color,
				) || isDynamicCss(color);

			const normalizeColor = (color) => {
				let normalized = color.trim().toLowerCase();
				try {
					if (/^#/i.test(color)) {
						normalized = Color(color).hex();
					} else if (/rgba/i.test(color)) {
						normalized = Color(color).rgb().string();
					} else if (/rgb/i.test(color)) {
						normalized = Color(color).rgb().string();
					} else if (/hsla/i.test(color)) {
						normalized = Color(color).hsl().string();
					} else if (/hsl/i.test(color)) {
						normalized = Color(color).hsl().string();
					}
				} catch (e) {}
				return normalized;
			};

			const toTokens = (prefix, unique) =>
				Object.entries(unique)
					.filter(([color]) => !isUnusableColor(color))
					.map(([key, value], index) => ({
						[`${prefix}-${index}`]: {
							value: normalizeColor(key),
							$extensions: {
								"com.project-wallace.count": value,
							},
						},
					}))
					.reduce((obj, item) => ({ ...obj, ...item }), {});

			const themeInput = {
				scraped: {
					color: toTokens("color", analysis.values.colors.unique),
					fontFamily: toTokens(
						"font-family",
						analysis.values.fontFamilies.unique,
					),
					fontSize: toTokens("font-size", analysis.values.fontSizes.unique),
					lineHeight: toTokens(
						"line-height",
						analysis.values.lineHeights.unique,
					),
				},
			};

			const wallaceFile = await open(themeInputPath, "w");

			await wallaceFile.writeFile(JSON.stringify(themeInput, null, 2));
			wallaceFile.close();
		}
	});
