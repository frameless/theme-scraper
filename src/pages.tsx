import { renderToStaticMarkup } from "react-dom/server";
import {
  Checkbox,
  Code,
  ColorSample,
  Document,
  FormField,
  FormLabel,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Paragraph,
  Select,
  SelectOption,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textbox,
  UnorderedList,
  UnorderedListItem,
  URLData,
} from "@utrecht/component-library-react";
import React, { PropsWithChildren } from "react";
import { open } from "node:fs/promises";
import { join } from "node:path";
import gemeenten from "./gemeenten.json";
import scrapedTokens from "../tmp/amersfoort-nl/scraped.tokens.json";
import { createGemeenteData } from "./util";

const PageTemplate = ({ children, title }: PropsWithChildren) => (
  <html lang="nl" dir="ltr">
    <head>
      <meta charSet="utf-8" />
      <title>{title}</title>
      <link
        rel="stylesheet"
        type="text/css"
        href="https://unpkg.com/@utrecht/component-library-css/dist/index.css"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="https://unpkg.com/@utrecht/design-tokens/dist/root.css"
      />
    </head>
    <body>
      <Document>{children}</Document>
    </body>
  </html>
);

const renderStandardsMode = (jsx) => `<!DOCTYPE html>
${renderToStaticMarkup(jsx)}
`;

const writeFile = async (path, data) => {
  console.log(`Write to ${path}`);
  const file = await open(path, "w");
  await file.writeFile(data);
  file.close();
};

const readJSON = async (path) => {
  console.log(`Load JSON: ${path}`);
  try {
    const file = await open(path, "r");
    const data = await file.readFile({ encoding: "utf8" });
    file.close();
    return JSON.parse(data);
  } catch (e) {
    console.warn(`Error loading JSON: ${path}`);
  }
};

const data = gemeenten.map(createGemeenteData);

data.forEach(async ({ slug, themeInputPath, url }) => {
  const scrapedTokens = await readJSON(themeInputPath);

  if (!scrapedTokens) {
    return;
  }

  // TODO: Generate one file for each gemeeente, not just for Amersfoort
  const pageHTML = renderStandardsMode(
    <PageTemplate title="Theme">
      <Heading1>Overzicht</Heading1>
      <Paragraph>
        Bron:{" "}
        <Link href={url} external>
          <URLData>{url}</URLData>
        </Link>
      </Paragraph>
      <Heading2>Gegevens verzamelen</Heading2>
      <Heading2>Basis</Heading2>
      <Heading3>Kleuren</Heading3>
      <Table style={{ inlineSize: "auto" }}>
        <TableHeader sticky>
          <TableHeaderCell></TableHeaderCell>
          <TableHeaderCell>Naam</TableHeaderCell>
          <TableHeaderCell>Kleur</TableHeaderCell>
          <TableHeaderCell>Kleurcode</TableHeaderCell>
          <TableHeaderCell>Aantal keer gebruikt</TableHeaderCell>
        </TableHeader>
        <TableBody>
          {Object.entries(scrapedTokens.scraped.color).map(
            ([name, token]: [string, any]) => (
              <TableRow>
                <TableCell>
                  <Checkbox defaultValue={token?.value} />
                </TableCell>
                <TableCell>
                  <ColorSample color={token?.value} />
                </TableCell>
                <TableCell>
                  <Textbox defaultValue={name} />
                </TableCell>
                <TableCell>
                  <Code>{token?.value}</Code>
                </TableCell>
                <TableCell>
                  <Code>
                    {token
                      ? token["$extensions"]["com.project-wallace.count"]
                      : ""}
                  </Code>
                </TableCell>
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
      <Heading3>Lettertypes</Heading3>
      <UnorderedList>
        {Object.values(scrapedTokens.scraped["fontFamily"]).map(({ value }) => (
          <UnorderedListItem>
            <Code>{value}</Code>
          </UnorderedListItem>
        ))}
      </UnorderedList>
      <Heading3>Lettergrootte</Heading3>
      <UnorderedList>
        {Object.values(scrapedTokens.scraped["fontSize"]).map(({ value }) => (
          <UnorderedListItem>
            <Code>{value}</Code>
          </UnorderedListItem>
        ))}
      </UnorderedList>
      <Heading3>Regelafstand</Heading3>
      <UnorderedList>
        {Object.values(scrapedTokens.scraped["lineHeight"]).map(({ value }) => (
          <UnorderedListItem>
            <Code>{value}</Code>
          </UnorderedListItem>
        ))}
      </UnorderedList>
      <Heading2>Concepten</Heading2>
      <Heading2>Componenten</Heading2>
      <Heading3>Link</Heading3>
      <FormField>
        <FormLabel>Color</FormLabel>
        <Select>
          {Object.entries(scrapedTokens.scraped.color).map(
            ([name, { value }]: [string, any]) => (
              <SelectOption>
                <ColorSample color={value} />
                {name}
              </SelectOption>
            ),
          )}
        </Select>
      </FormField>
    </PageTemplate>,
  );

  writeFile(join("tmp", slug, "index.html"), pageHTML);
});

// TODO: Generate one file for each gemeeente, not just for Amersfoort
const indexHTML = renderStandardsMode(
  <PageTemplate title="Overzicht">
    <Heading1>Overzicht</Heading1>
    <Table style={{ inlineSize: "auto" }}>
      <TableHeader sticky>
        <TableHeaderCell>Gemeente</TableHeaderCell>
        <TableHeaderCell>Website</TableHeaderCell>
        <TableHeaderCell></TableHeaderCell>
      </TableHeader>
      <TableBody>
        {data.map(({ slug, url }) => (
          <TableRow>
            <TableHeaderCell>Naam onbekend</TableHeaderCell>
            <TableCell>
              <URLData>{url}</URLData>
            </TableCell>
            <TableCell>
              <Link href={`${slug}/index.html`}>Details</Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </PageTemplate>,
);

writeFile(join("tmp", "index.html"), indexHTML);
