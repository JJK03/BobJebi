import { execFileSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { adaptIncheonRows } from "./sync-incheon-food-api.mjs";

const BASIC_CSV_ENTRY =
  "DATAGO_INCHEON_2022.RSTR_INFO/DATAGO_INCHEON_2025.RSTR_INFO_KOREAN.csv";
const MENU_SHEET_ENTRY = "xl/worksheets/sheet1.xml";
const SHARED_STRINGS_ENTRY = "xl/sharedStrings.xml";
const DEFAULT_DATA_PATH = "public/data/incheon-restaurants.json";
const ARCHIVE_BUFFER_LIMIT = 512 * 1024 * 1024;

function readArgument(name, fallback = "") {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

function readArchiveEntry(archivePath, entryPath) {
  return execFileSync("tar", ["-xOf", archivePath, entryPath], {
    maxBuffer: ARCHIVE_BUFFER_LIMIT,
  }).toString("utf8");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((part) => decodeXml(part[1]))
      .join(""),
  );
}

function columnIndex(reference) {
  const letters = reference.match(/[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }
  return index - 1;
}

function parseWorksheet(xml, sharedStrings) {
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const content = cellMatch[2];
      const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1] ?? "A1";
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = content.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inlineValue = content.match(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/)?.[1];
      const value =
        type === "s"
          ? sharedStrings[Number(rawValue)] ?? ""
          : inlineValue !== undefined
            ? decodeXml(inlineValue)
            : rawValue;
      row[columnIndex(reference)] = value;
    }
    rows.push(row);
  }

  return rows;
}

function recordsFromRows(rows, fieldMap) {
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) =>
    Object.fromEntries(
      headers
        .map((header, index) => [fieldMap[header], row[index]])
        .filter(([field]) => field),
    ),
  );
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function main() {
  const restaurantArchive = readArgument("restaurants-zip");
  const menuWorkbook = readArgument("menus-xlsx");
  if (!restaurantArchive || !menuWorkbook) {
    throw new Error(
      "--restaurants-zip과 --menus-xlsx에 공식 파일 경로를 지정해 주세요.",
    );
  }

  console.log("공식 파일에서 한국어 매장·메뉴 정보를 읽는 중입니다…");
  const restaurantRows = recordsFromRows(
    parseCsv(readArchiveEntry(resolve(restaurantArchive), BASIC_CSV_ENTRY)),
    {
      "식당(ID)": "RSTR_ID",
      식당명: "RSTR_NM",
      지점명: "BRNCH_NM",
      도로명주소: "ROAD_NM_ADDR",
      지번주소: "LOTNO_ADDR",
      식당위도: "RSTR_LAT",
      식당경도: "RSTR_LOT",
      식당대표전화번호: "RSTR_RPRS_TELNO",
      영업신고증업태명: "BIZ_CRTFCT_BZSTAT_NM",
      영업인허가명: "BIZ_LCPMT_NM",
      식당소개내용: "RSTR_EXPLN_CN",
    },
  );

  const sharedStrings = parseSharedStrings(
    readArchiveEntry(resolve(menuWorkbook), SHARED_STRINGS_ENTRY),
  );
  const menuRows = recordsFromRows(
    parseWorksheet(
      readArchiveEntry(resolve(menuWorkbook), MENU_SHEET_ENTRY),
      sharedStrings,
    ),
    {
      "메뉴(ID)": "MENU_ID",
      메뉴명: "MENU_NM",
      메뉴가격: "MENU_PRC",
      지역특산메뉴여부: "SPCLT_MENU_YN",
      지역특산메뉴명: "SPCLT_MENU_NM",
      "지역특산메뉴출처(URL)": "SPCLT_MENU_SRC_URL",
      지역명: "RGN_NM",
      "식당(ID)": "RSTR_ID",
      식당명: "RSTR_NM",
      지점명: "BRNCH_NM",
    },
  );

  const restaurants = adaptIncheonRows(restaurantRows, menuRows);
  if (restaurantRows.length < 1_000 || menuRows.length < 1_000) {
    throw new Error("공식 파일의 행 수가 예상보다 적어 결과를 저장하지 않았습니다.");
  }
  if (restaurants.length === 0) {
    throw new Error("앱용 인천 식당이 한 곳도 없어 결과를 저장하지 않았습니다.");
  }

  const dataPath = resolve(readArgument("data", DEFAULT_DATA_PATH));
  await writeJsonAtomic(dataPath, restaurants);
  console.log(
    `완료: 매장 ${restaurantRows.length.toLocaleString("ko-KR")}건 + 메뉴 ${menuRows.length.toLocaleString("ko-KR")}건 → 앱용 ${restaurants.length.toLocaleString("ko-KR")}건`,
  );
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
