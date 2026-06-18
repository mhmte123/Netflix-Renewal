import { customMenus } from "@/data/mainMenu";

export type SearchOptionGroup = "genre" | "mood";

export type SearchOption = {
  label: string;
  value: string;
  icon: string;
  group: SearchOptionGroup;
  query: Record<string, string>;
  tvQuery?: Record<string, string>;
};

const optionMeta: Record<
  string,
  {
    query: Record<string, string>;
    tvQuery?: Record<string, string>;
  }
> = {
  action: { query: { with_genres: "28" }, tvQuery: { with_genres: "10759" } },
  animation: { query: { with_genres: "16" }, tvQuery: { with_genres: "16" } },
  comedy: { query: { with_genres: "35" }, tvQuery: { with_genres: "35" } },
  documentary: { query: { with_genres: "99" }, tvQuery: { with_genres: "99" } },
  drama: { query: { with_genres: "18" }, tvQuery: { with_genres: "18" } },
  fantasy: { query: { with_genres: "14" }, tvQuery: { with_genres: "10765" } },
  horror: { query: { with_genres: "27" }, tvQuery: { with_genres: "9648" } },
  mystery: { query: { with_genres: "9648" }, tvQuery: { with_genres: "9648" } },
  romance: { query: { with_genres: "10749" }, tvQuery: { with_genres: "10749" } },
  scifi: { query: { with_genres: "878" }, tvQuery: { with_genres: "10765" } },
  thriller: { query: { with_genres: "53" }, tvQuery: { with_genres: "9648" } },
  war: { query: { with_genres: "10752" }, tvQuery: { with_genres: "10768" } },
  chill: { query: { with_genres: "18,10749" }, tvQuery: { with_genres: "18" } },
  dark: { query: { with_genres: "53,9648" }, tvQuery: { with_genres: "80,9648" } },
  emotional: { query: { with_genres: "18,10749" }, tvQuery: { with_genres: "18" } },
  exciting: { query: { with_genres: "28,12" }, tvQuery: { with_genres: "10759,10765" } },
  funny: { query: { with_genres: "35" }, tvQuery: { with_genres: "35" } },
  romantic: { query: { with_genres: "10749,35" }, tvQuery: { with_genres: "10749" } },
  scary: { query: { with_genres: "27" }, tvQuery: { with_genres: "9648" } },
  thoughtful: { query: { with_genres: "18,99" }, tvQuery: { with_genres: "18,99" } },
};

const makeOptions = (group: SearchOptionGroup) =>
  customMenus
    .filter((menu) => menu.path.startsWith(`/${group}/`))
    .map<SearchOption>((menu) => {
      const value = menu.path.replace(`/${group}/`, "");
      const meta = optionMeta[value] ?? { query: {} };

      return {
        label: menu.title,
        value,
        icon: menu.imgUrl,
        group,
        ...meta,
      };
    });

export const genreOptions = makeOptions("genre");
export const moodOptions = makeOptions("mood");
export const allSearchOptions = [...genreOptions, ...moodOptions];

export const getSearchOptionQuery = (
  option: SearchOption,
  mediaType: "movie" | "tv",
) => (mediaType === "tv" && option.tvQuery ? option.tvQuery : option.query);

export const getSearchOptionLabels = (
  group: SearchOptionGroup,
  values: string[],
) => {
  const options = group === "genre" ? genreOptions : moodOptions;

  return values
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((label): label is string => Boolean(label));
};

export const RECENT_SEARCH_STORAGE_KEY = "netflix-recent-searches";
export const MAX_RECENT_SEARCH_COUNT = 8;

const normalizeRecentKeyword = (keyword: string) => keyword.trim();

export const loadRecentSearches = () => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCH_COUNT)
      : [];
  } catch {
    return [];
  }
};

export const saveRecentSearches = (items: string[]) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    RECENT_SEARCH_STORAGE_KEY,
    JSON.stringify(items.slice(0, MAX_RECENT_SEARCH_COUNT)),
  );
};

export const addRecentSearch = (keyword: string, currentItems = loadRecentSearches()) => {
  const normalizedKeyword = normalizeRecentKeyword(keyword);
  if (!normalizedKeyword) return currentItems;

  const nextItems = [
    normalizedKeyword,
    ...currentItems.filter((item) => item !== normalizedKeyword),
  ].slice(0, MAX_RECENT_SEARCH_COUNT);

  saveRecentSearches(nextItems);
  return nextItems;
};

export const removeRecentSearch = (keyword: string, currentItems = loadRecentSearches()) => {
  const nextItems = currentItems.filter((item) => item !== keyword);
  saveRecentSearches(nextItems);
  return nextItems;
};

export const clearRecentSearches = () => {
  saveRecentSearches([]);
  return [];
};
